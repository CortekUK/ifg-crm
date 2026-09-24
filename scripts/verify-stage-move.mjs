// A recruiter moving a card must not have it moved back.
//
// Exercises the real trigger chain on the real database: creating a deal in
// Initial Lead auto-enrols it in that pipeline's follow-up automation, and
// moving it to a stage on the automation's stop list stops the enrollment —
// which used to drag the deal to Contact Response in the same transaction.
//
//   node scripts/verify-stage-move.mjs        (add --keep to skip cleanup)
//
// WRITES TO THE LIVE DATABASE. The test contact is unsubscribed so the
// automation can never email it, uses an @stage-verify.invalid address, and
// everything it creates is deleted in a finally block.

import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const EMAIL = `stage-check@stage-verify.invalid`
const KEEP = process.argv.includes('--keep')
let passed = 0, failed = 0
const check = (label, ok, detail = '') => {
  if (ok) { passed++; console.log(`  ok    ${label}`) }
  else { failed++; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`) }
}

let contactId = null
let dealId = null

const stageOf = async (id) => {
  const { data } = await admin.from('deals').select('current_stage_id').eq('id', id).single()
  return data.current_stage_id
}

try {
  const { data: pipeline } = await admin.from('pipelines').select('id, name').ilike('name', '%UNIVERSITY%').single()
  const { data: stages } = await admin.from('pipeline_stages').select('id, name').eq('pipeline_id', pipeline.id)
  const stage = (n) => stages.find((s) => s.name === n).id
  const nameOf = (id) => stages.find((s) => s.id === id)?.name ?? id

  const { data: automation } = await admin
    .from('automations')
    .select('id, name, exit_to_stage_id, stop_on_stage_ids')
    .eq('pipeline_id', pipeline.id)
    .eq('trigger_stage_id', stage('Initial Lead'))
    .not('exit_to_stage_id', 'is', null)
    .single()

  console.log(`pipeline: ${pipeline.name}`)
  console.log(`automation: ${automation.name.trim()} -> exit stage "${nameOf(automation.exit_to_stage_id)}"`)
  check('Zoom Scheduled is one of the automation\'s stop stages',
    (automation.stop_on_stage_ids ?? []).includes(stage('Zoom Scheduled')))

  // Unsubscribed: process-automations skips non-subscribed contacts, so this
  // deal can never cause an email to a fake address.
  const { data: contact, error: cErr } = await admin.from('contacts').insert({
    email: EMAIL, first_name: 'Stage', last_name: 'Check',
    subscription_status: 'unsubscribed', sport: 'football', source: 'manual',
  }).select('id').single()
  if (cErr) throw cErr
  contactId = contact.id

  const { data: deal, error: dErr } = await admin.from('deals').insert({
    title: 'Stage move verification', contact_id: contactId, pipeline_id: pipeline.id,
    current_stage_id: stage('Initial Lead'),
  }).select('id').single()
  if (dErr) throw dErr
  dealId = deal.id

  const { data: enrol } = await admin
    .from('automation_enrollments').select('id, status').eq('deal_id', dealId)
  check('new deal in Initial Lead is enrolled in the follow-up sequence',
    (enrol ?? []).some((e) => e.status === 'active'), JSON.stringify(enrol))

  // ---- the bug: recruiter drags the card to Zoom Scheduled ----
  console.log('\nrecruiter moves the card to Zoom Scheduled:')
  await admin.from('deals').update({ current_stage_id: stage('Zoom Scheduled') }).eq('id', dealId)

  const after = await stageOf(dealId)
  check(`card stays in Zoom Scheduled (was landing in ${nameOf(automation.exit_to_stage_id)})`,
    after === stage('Zoom Scheduled'), `ended in ${nameOf(after)}`)

  const { data: afterEnrol } = await admin
    .from('automation_enrollments').select('status, stopped_reason').eq('deal_id', dealId)
  check('the follow-up sequence still stops, so no more emails go out',
    (afterEnrol ?? []).every((e) => e.status !== 'active'), JSON.stringify(afterEnrol))

  const { data: hist } = await admin
    .from('deal_stage_history').select('from_stage_id, to_stage_id').eq('deal_id', dealId)
  check('exactly one stage change recorded, not two',
    (hist ?? []).length === 1,
    (hist ?? []).map((h) => `${nameOf(h.from_stage_id)}->${nameOf(h.to_stage_id)}`).join(', '))

  // ---- the behaviour worth keeping: a genuine reply ----
  console.log('\na genuine reply arrives:')
  const { data: ids } = await admin.from('automation_enrollments').select('id').eq('deal_id', dealId)
  await admin.from('automation_enrollments')
    .update({ status: 'active', stopped_reason: null }).eq('id', ids[0].id)
  await admin.from('automation_enrollments')
    .update({ status: 'stopped', stopped_reason: 'Contact replied to email' }).eq('id', ids[0].id)

  const replied = await stageOf(dealId)
  check(`a reply still moves the deal to ${nameOf(automation.exit_to_stage_id)}`,
    replied === automation.exit_to_stage_id, `ended in ${nameOf(replied)}`)
} finally {
  if (KEEP) {
    console.log('\n--keep: leaving the test deal in place')
  } else {
    if (dealId) {
      await admin.from('automation_enrollments').delete().eq('deal_id', dealId)
      await admin.from('deal_stage_history').delete().eq('deal_id', dealId)
      await admin.from('deal_activities').delete().eq('deal_id', dealId)
      await admin.from('deals').delete().eq('id', dealId)
    }
    if (contactId) {
      await admin.from('contact_lists').delete().eq('contact_id', contactId)
      await admin.from('contact_tags').delete().eq('contact_id', contactId)
      await admin.from('contacts').delete().eq('id', contactId)
    }
    const { data: left } = await admin.from('contacts').select('email').eq('email', EMAIL)
    console.log(`\ncleanup: ${left?.length ? 'LEFTOVER — delete ' + EMAIL : 'test deal and contact removed'}`)
  }
  console.log(failed === 0 ? `\nPASS (${passed} checks)` : `\nFAIL (${failed} of ${passed + failed})`)
  process.exitCode = failed === 0 ? 0 : 1
}
