import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Reconciles the auto-managed "send this brochure when a deal enters a stage"
 * automations for ONE brochure so they match its `brochure_pipelines` rows.
 *
 * This reuses the existing (already-deployed) automation engine: an
 * `enters_stage` trigger + a single `send_email` step whose template links to the
 * brochure's public flipbook (`/b/<slug>?v=1`, gate skipped for the known lead).
 * No new edge function / deployment is needed.
 *
 * Safety: automations that are no longer wanted are DEACTIVATED (is_active=false),
 * never deleted — so we never break existing enrollments or hit FK constraints.
 * Idempotent: safe to call on every save.
 *
 * Must be called with a SERVICE-ROLE client (writes automations/templates).
 */
const SITE_ORIGIN = 'https://theinternationalfootballgroup.com'

export async function syncBrochureAutomations(
  supabase: SupabaseClient,
  brochureId: string,
): Promise<void> {
  const { data: b } = await supabase
    .from('website_brochures')
    .select('id, slug, title')
    .eq('id', brochureId)
    .maybeSingle()
  if (!b) return

  const link = `${SITE_ORIGIN}/b/${b.slug}?v=1`
  const tplName = `Brochure: ${b.title}`
  const subject = `${b.title} 📘`
  const bodyHtml = `<div style="font-family:Arial,Helvetica,sans-serif;color:#0E1413;font-size:16px;line-height:1.6;max-width:560px">
<p>Hi {{first_name}},</p>
<p>Here's the ${b.title} — everything you need in one place:</p>
<p style="text-align:center;margin:30px 0"><a href="${link}" style="background:#BE1623;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 32px;border-radius:999px;display:inline-block">View the brochure →</a></p>
<p>Any questions at all, just reply to this email.</p>
<p>Best,<br>{{deal_owner_name|Nathan Bibby}}<br>The International Football Group</p>
</div>`

  // 1. Reusable email template for this brochure (create or refresh).
  let templateId: string | null = null
  const { data: tpl } = await supabase.from('email_templates').select('id').eq('name', tplName).maybeSingle()
  if (tpl?.id) {
    templateId = tpl.id
    await supabase.from('email_templates').update({ subject, body_html: bodyHtml }).eq('id', templateId)
  } else {
    const { data: created } = await supabase
      .from('email_templates')
      .insert({ name: tplName, subject, body_html: bodyHtml, category: 'automation', from_name_type: 'deal_owner', is_draft: false })
      .select('id')
      .single()
    templateId = created?.id ?? null
  }
  if (!templateId) return

  // 2. Desired (pipeline, stage) targets from the attach rows. A null stage_id
  //    resolves to the pipeline's Follow Up stage (else its first stage).
  const { data: rows } = await supabase
    .from('brochure_pipelines')
    .select('pipeline_id, stage_id')
    .eq('brochure_id', brochureId)

  // Name lookups for readable automation names.
  const { data: pipes } = await supabase.from('pipelines').select('id, name')
  const pipeName = new Map((pipes ?? []).map((p) => [p.id as string, p.name as string]))

  const desired: { pipeline_id: string; stage_id: string; stage_name: string }[] = []
  for (const r of rows ?? []) {
    const { data: stages } = await supabase
      .from('pipeline_stages')
      .select('id, name, stage_type, display_order')
      .eq('pipeline_id', r.pipeline_id)
      .order('display_order', { ascending: true })
    const list = stages ?? []
    let stage = r.stage_id ? list.find((s) => s.id === r.stage_id) : undefined
    if (!stage) stage = list.find((s) => s.stage_type === 'follow_up') ?? list[0]
    if (stage) desired.push({ pipeline_id: r.pipeline_id, stage_id: stage.id, stage_name: stage.name })
  }

  const keyOf = (p: string, s: string) => `${p}::${s}`
  const desiredByKey = new Map(desired.map((d) => [keyOf(d.pipeline_id, d.stage_id), d]))

  // 3. Existing auto-managed automations for this brochure.
  const { data: autos } = await supabase
    .from('automations')
    .select('id, pipeline_id, trigger_stage_id')
    .filter('config->>brochure_id', 'eq', brochureId)
  const existing = autos ?? []
  const existingByKey = new Map(
    existing.map((a) => [keyOf(a.pipeline_id as string, a.trigger_stage_id as string), a]),
  )

  // Deactivate ones no longer wanted (never delete → no FK/enrollment breakage).
  for (const a of existing) {
    const k = keyOf(a.pipeline_id as string, a.trigger_stage_id as string)
    if (!desiredByKey.has(k)) await supabase.from('automations').update({ is_active: false }).eq('id', a.id)
  }

  // Ensure each desired target has an active automation + send_email step.
  for (const d of desired) {
    const k = keyOf(d.pipeline_id, d.stage_id)
    const found = existingByKey.get(k)
    if (found) {
      await supabase.from('automations').update({ is_active: true }).eq('id', found.id)
      const { data: steps } = await supabase.from('automation_steps').select('id').eq('automation_id', found.id).limit(1)
      if (!steps || steps.length === 0) {
        await supabase.from('automation_steps').insert({
          automation_id: found.id, step_order: 1, step_type: 'send_email', email_template_id: templateId, delay_days: 0, delay_hours: 0,
        })
      } else {
        await supabase.from('automation_steps').update({ email_template_id: templateId }).eq('id', steps[0].id)
      }
    } else {
      const { data: created } = await supabase
        .from('automations')
        .insert({
          name: `Brochure: ${b.title} → ${pipeName.get(d.pipeline_id) ?? 'Pipeline'} / ${d.stage_name}`,
          description: `Sends the "${b.title}" brochure link when a deal enters this stage.`,
          pipeline_id: d.pipeline_id,
          trigger_stage_id: d.stage_id,
          automation_type: 'follow_up',
          trigger_type: 'enters_stage',
          is_active: true,
          exit_on_reply: false,
          config: { brochure_id: brochureId, brochure_send: true },
        })
        .select('id')
        .single()
      if (created?.id) {
        await supabase.from('automation_steps').insert({
          automation_id: created.id, step_order: 1, step_type: 'send_email', email_template_id: templateId, delay_days: 0, delay_hours: 0,
        })
      }
    }
  }
}
