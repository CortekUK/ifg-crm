import type { SupabaseClient } from '@supabase/supabase-js'

import { renderBlocksToHTML } from '@/lib/templates/render-html'
import { defaultBlockContent, type EditorBlock } from '@/lib/templates/editor-types'

/**
 * The blocks a brochure email is made of.
 *
 * Built from real editor blocks rather than a string of HTML, for two
 * reasons. It inherits the global theme and branding like every other
 * template — the hand-written version did not, so these three were the only
 * emails in the system that ignored the brand. And it opens in the editor as
 * something you can change, instead of one unreadable HTML block.
 */
function brochureBlocks(b: { id: string; slug: string; title: string; description?: string | null; cover_image?: string | null; page_count?: number | null; page_images?: string[] | null }): EditorBlock[] {
  const cover = b.cover_image || b.page_images?.[0] || ''
  const pages = b.page_count ?? b.page_images?.length ?? 0

  return [
    {
      id: `${b.id}-intro`,
      type: 'text',
      content: {
        ...defaultBlockContent.text,
        html: `<p>Hi {{first_name}},</p><p>Here is the ${escapeText(b.title)} — the programme week, what is included, the costs and the entry requirements, all in one place.</p>`,
        paddingTop: 0,
        paddingBottom: 8,
      },
    },
    {
      id: `${b.id}-brochure`,
      type: 'brochure',
      content: {
        ...defaultBlockContent.brochure,
        brochureId: b.id,
        slug: b.slug,
        title: b.title,
        description: b.description ?? '',
        coverImage: cover,
        pageCount: pages,
        buttonText: 'Open the brochure',
        layout: 'wide',
        showPageCount: true,
      },
    },
    {
      id: `${b.id}-outro`,
      type: 'text',
      content: {
        ...defaultBlockContent.text,
        html: `<p>It opens in the browser — no download, and it works on a phone.</p><p>Any questions at all, just reply to this email and it comes straight to me.</p>`,
        paddingTop: 12,
        paddingBottom: 0,
      },
    },
  ] as EditorBlock[]
}

/** Titles come from user input and land inside HTML. */
function escapeText(value: string): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

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
export async function syncBrochureAutomations(
  supabase: SupabaseClient,
  brochureId: string,
): Promise<void> {
  const { data: b } = await supabase
    .from('website_brochures')
    .select('id, slug, title, description, cover_image, page_count, page_images')
    .eq('id', brochureId)
    .maybeSingle()
  if (!b) return

  const tplName = `Brochure: ${b.title}`
  const subject = `${b.title} 📘`
  const blocks = brochureBlocks(b)

  // 1. Reusable email template for this brochure.
  //
  // On refresh this deliberately does NOT overwrite a template someone has
  // edited. It re-renders the brochure BLOCK in place — cover, title, page
  // count, link — and leaves every other block alone. The previous version
  // replaced the whole body on every brochure save, so any edit to these
  // three emails was silently discarded the next time the brochure was
  // touched.
  let templateId: string | null = null
  const { data: tpl } = await supabase
    .from('email_templates')
    .select('id, body_json, theme')
    .eq('name', tplName)
    .maybeSingle()

  if (tpl?.id) {
    templateId = tpl.id
    const existing = Array.isArray(tpl.body_json) ? (tpl.body_json as EditorBlock[]) : []
    const hasBrochureBlock = existing.some((blk) => blk?.type === 'brochure')

    const nextBlocks = hasBrochureBlock
      ? existing.map((blk) =>
          blk.type === 'brochure'
            ? {
                ...blk,
                content: {
                  ...blk.content,
                  brochureId: b.id,
                  slug: b.slug,
                  title: b.title,
                  coverImage: b.cover_image || b.page_images?.[0] || blk.content?.coverImage || '',
                  pageCount: b.page_count ?? b.page_images?.length ?? blk.content?.pageCount ?? 0,
                },
              }
            : blk,
        )
      : blocks

    await supabase
      .from('email_templates')
      .update({
        subject,
        body_json: nextBlocks,
        body_html: renderBlocksToHTML(nextBlocks, (tpl.theme as never) ?? null),
      })
      .eq('id', templateId)
  } else {
    const { data: created } = await supabase
      .from('email_templates')
      .insert({
        name: tplName,
        subject,
        body_json: blocks,
        body_html: renderBlocksToHTML(blocks),
        category: 'automation',
        from_name_type: 'deal_owner',
        is_draft: false,
      })
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
