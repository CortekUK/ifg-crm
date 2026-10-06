/**
 * Turn the Dormant re-engagement reminder on for automations that don't have it.
 *
 * Migrations 134/135 enabled it on three automations by hardcoded id (UK Gap,
 * Summer Residency, University of Lancashire INITIAL CONTACT MAP). Any other
 * pipeline's dormant leads currently get nothing.
 *
 * This is a SCRIPT, not a migration, on purpose. Enabling it starts an
 * indefinite fortnightly email to real people on a pipeline that wasn't
 * sending them, and that is a decision for IFG to make per pipeline — not
 * something that should fire silently the next time someone runs a deploy.
 *
 * Usage:
 *   node scripts/enable-dormant-reminder.mjs                 # dry run (default)
 *   node scripts/enable-dormant-reminder.mjs --apply         # enable on all candidates
 *   node scripts/enable-dormant-reminder.mjs --apply --id=<uuid>   # just one
 *
 * A candidate is an automation that:
 *   - is active
 *   - is of type initial_contact or follow_up (the two the compiler supports)
 *   - has no_reply_stage_id set (that stage is both the Dormant target and the
 *     loop anchor — without it there is nothing to anchor to)
 *   - does not already have dormant_reminder_enabled
 *
 * What enabling does, mirroring lib/automations/compile.ts exactly:
 *   append  move_to_stage → Dormant
 *           send_email    → the shared reminder template
 *           wait          → INTERVAL_DAYS
 *   and set config.recurring / recurring_loop_to_order / recurring_anchor_stage_id
 *   plus the user-facing dormant_reminder_* fields, so re-saving the automation
 *   in the CRM regenerates this same tail instead of dropping it (the lesson of
 *   migration 135).
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const APPLY = process.argv.includes('--apply')
const ONLY_ID = (process.argv.find((a) => a.startsWith('--id=')) || '').slice('--id='.length) || null

/** Must match DEFAULT_DORMANT_INTERVAL_DAYS in lib/automations/compile.ts. */
const INTERVAL_DAYS = 14
/** The shared template seeded by migration 134. */
const TEMPLATE_ID = 'a1b2c3d4-0000-4000-8000-000000000134'
const ELIGIBLE_TYPES = ['initial_contact', 'follow_up']

async function main() {
  const { data: template } = await sb
    .from('email_templates').select('id, name').eq('id', TEMPLATE_ID).maybeSingle()
  if (!template) {
    console.error(`Reminder template ${TEMPLATE_ID} is missing — apply migration 134 first.`)
    process.exit(1)
  }

  const { data: automations, error } = await sb
    .from('automations')
    .select('id, name, automation_type, is_active, no_reply_stage_id, config')
    .eq('is_active', true)
  if (error) { console.error('Could not read automations:', error.message); process.exit(1) }

  const candidates = []
  const skipped = []
  for (const a of automations ?? []) {
    if (ONLY_ID && a.id !== ONLY_ID) continue
    const cfg = a.config || {}
    if (cfg.dormant_reminder_enabled === true) { skipped.push([a, 'already enabled']); continue }
    if (!ELIGIBLE_TYPES.includes(a.automation_type)) { skipped.push([a, `type ${a.automation_type} not supported`]); continue }
    if (!a.no_reply_stage_id) { skipped.push([a, 'no Dormant / no-reply stage set']); continue }
    candidates.push(a)
  }

  console.log(`\nDormant reminder — every ${INTERVAL_DAYS} days, template "${template.name}"\n`)

  if (skipped.length) {
    console.log('Skipped:')
    for (const [a, why] of skipped) console.log(`  · ${a.name} — ${why}`)
    console.log('')
  }

  if (!candidates.length) {
    console.log('No automations to enable. Nothing to do.\n')
    return
  }

  console.log(`${candidates.length} automation(s) would be enabled:`)
  for (const a of candidates) console.log(`  · ${a.name}  (${a.automation_type}, ${a.id})`)

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply to enable.')
    console.log('NOTE: enabling starts an indefinite fortnightly email to every')
    console.log('dormant lead in these pipelines. Confirm with IFG first.\n')
    return
  }

  for (const a of candidates) {
    const { data: steps } = await sb
      .from('automation_steps').select('step_order')
      .eq('automation_id', a.id).order('step_order', { ascending: false }).limit(1)
    const base = steps?.[0]?.step_order ?? 0

    const moveOrder = base + 1
    const emailOrder = base + 2
    const waitOrder = base + 3

    const { error: stepErr } = await sb.from('automation_steps').insert([
      { automation_id: a.id, step_order: moveOrder, step_type: 'move_to_stage', delay_days: 0, delay_hours: 0, target_stage_id: a.no_reply_stage_id },
      { automation_id: a.id, step_order: emailOrder, step_type: 'send_email', delay_days: 0, delay_hours: 0, email_template_id: TEMPLATE_ID },
      { automation_id: a.id, step_order: waitOrder, step_type: 'wait', delay_days: INTERVAL_DAYS, delay_hours: 0 },
    ])
    if (stepErr) { console.error(`  ✗ ${a.name}: ${stepErr.message}`); continue }

    const { error: cfgErr } = await sb.from('automations').update({
      config: {
        ...(a.config || {}),
        recurring: true,
        recurring_loop_to_order: emailOrder,
        recurring_anchor_stage_id: a.no_reply_stage_id,
        dormant_reminder_enabled: true,
        dormant_reminder_template_id: TEMPLATE_ID,
        dormant_reminder_interval_days: INTERVAL_DAYS,
      },
    }).eq('id', a.id)
    if (cfgErr) { console.error(`  ✗ ${a.name}: ${cfgErr.message}`); continue }

    console.log(`  ✓ ${a.name} — reminder every ${INTERVAL_DAYS} days, looping to step ${emailOrder}`)
  }
  console.log('')
}

main().catch((e) => { console.error(e); process.exit(1) })
