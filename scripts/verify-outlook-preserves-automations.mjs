// Proves that a reply arriving through OUTLOOK still stops a follow-up
// sequence, exactly as a reply arriving through Resend does.
//
// This is the single most important "did we break anything" check in the
// Outlook work. The behaviour lives in a database trigger on email_replies
// (stop_enrollments_on_reply_match), so an Outlook reply inherits it only if
// the row is shaped identically. This runs it for real.
//
// SAFETY: the automation it creates is is_active = false, so the live
// process-automations cron (every 5 minutes) will never pick the enrolment up
// and cannot send anybody an email. Everything is deleted in the finally block.
//
//   node scripts/verify-outlook-preserves-automations.mjs
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const TEST_EMAIL = 'hamna+testing123@gmail.com'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

let pass = 0, fail = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (ok) pass++
  else fail++
}

const ids = { contact: null, deal: null, automation: null, enrollment: null, log: null, send: null, replies: [] }

async function buildFixture(label) {
  const { data: pipeline } = await supabase.from('pipelines').select('id').limit(1).single()
  const { data: stage } = await supabase
    .from('pipeline_stages').select('id').eq('pipeline_id', pipeline.id)
    .order('display_order', { ascending: true }).limit(1).single()
  const { data: owner } = await supabase
    .from('profiles').select('id').eq('is_active', true)
    .in('role', ['admin', 'super_admin']).limit(1).single()

  const { data: deal, error: dealErr } = await supabase.from('deals').insert({
    contact_id: ids.contact, pipeline_id: pipeline.id, current_stage_id: stage.id,
    deal_owner_id: owner.id, title: `QA Outlook ${label}`, deal_value: 0,
  }).select('id').single()
  if (dealErr) throw dealErr
  ids.deal = deal.id

  // is_active:false — the cron engine filters on it, so this enrolment is inert.
  const { data: automation, error: autoErr } = await supabase.from('automations').insert({
    name: `QA Outlook Verify ${label} (inactive)`, is_active: false,
    pipeline_id: pipeline.id, trigger_stage_id: stage.id,
  }).select('id').single()
  if (autoErr) throw autoErr
  ids.automation = automation.id

  const { data: enrollment, error: enrErr } = await supabase.from('automation_enrollments').insert({
    automation_id: automation.id, deal_id: deal.id, status: 'active',
    enrolled_at: new Date(Date.now() - 3_600_000).toISOString(),
  }).select('id, status').single()
  if (enrErr) throw enrErr
  ids.enrollment = enrollment.id

  const { data: log, error: logErr } = await supabase.from('automation_logs').insert({
    enrollment_id: enrollment.id, deal_id: deal.id, status: 'sent',
  }).select('id').single()
  if (logErr) throw logErr
  ids.log = log.id

  const { data: send, error: sendErr } = await supabase.from('email_sends').insert({
    recipient_email: TEST_EMAIL, recipient_contact_id: ids.contact,
    subject: 'QA Outlook outreach', automation_log_id: log.id,
    status: 'sent', sent_at: new Date().toISOString(),
  }).select('id').single()
  if (sendErr) throw sendErr
  ids.send = send.id
  return enrollment
}

async function teardownFixture() {
  if (ids.send) await supabase.from('email_sends').delete().eq('id', ids.send)
  if (ids.log) await supabase.from('automation_logs').delete().eq('id', ids.log)
  if (ids.enrollment) await supabase.from('automation_enrollments').delete().eq('id', ids.enrollment)
  if (ids.automation) await supabase.from('automations').delete().eq('id', ids.automation)
  if (ids.deal) await supabase.from('deals').delete().eq('id', ids.deal)
  ids.send = ids.log = ids.enrollment = ids.automation = ids.deal = null
}

try {
  const { data: contact, error } = await supabase.from('contacts')
    .insert({ first_name: 'QA', last_name: 'Outlook Automation', email: TEST_EMAIL })
    .select('id').single()
  if (error) throw error
  ids.contact = contact.id

  // ── A. a genuine Outlook reply stops the sequence ──────────────────────
  console.log('\nA. Genuine reply arriving through Outlook')
  await buildFixture('A')
  const { data: replyA } = await supabase.from('email_replies').insert({
    contact_id: ids.contact, from_email: TEST_EMAIL, subject: 'Re: QA Outlook outreach',
    body: 'Yes please, I am interested.', source: 'outlook',
    conversation_id: 'conv-qa-automation-A', internet_message_id: '<qa-auto-a@verify.local>',
    graph_message_id: 'graph-qa-a', match_status: 'auto_matched',
    ai_intent: 'positive', is_auto_reply: false,
    received_at: new Date().toISOString(), processed: false,
  }).select('id').single()
  ids.replies.push(replyA.id)

  const { data: afterA } = await supabase.from('automation_enrollments')
    .select('status, stopped_reason').eq('id', ids.enrollment).single()
  check('enrolment stopped by the Outlook reply', afterA.status === 'stopped', `status=${afterA.status}`)
  console.log(`     reason: ${afterA.stopped_reason ?? '(none)'}`)
  await teardownFixture()

  // ── B. an autoresponder must NOT stop it (QA-28 Bug 3) ────────────────
  console.log('\nB. Out-of-office autoresponder arriving through Outlook')
  await buildFixture('B')
  const { data: replyB } = await supabase.from('email_replies').insert({
    contact_id: ids.contact, from_email: TEST_EMAIL, subject: 'Automatic reply: Out of office',
    body: 'I am on leave.', source: 'outlook',
    conversation_id: 'conv-qa-automation-B', internet_message_id: '<qa-auto-b@verify.local>',
    match_status: 'auto_matched', ai_intent: 'neutral', is_auto_reply: true,
    received_at: new Date().toISOString(), processed: false,
  }).select('id').single()
  ids.replies.push(replyB.id)

  const { data: afterB } = await supabase.from('automation_enrollments')
    .select('status').eq('id', ids.enrollment).single()
  check('autoresponder left the sequence running', afterB.status === 'active', `status=${afterB.status}`)
  await teardownFixture()

  // ── C. unsubscribe intent still unsubscribes (migration 230) ──────────
  console.log('\nC. "Stop emailing me" arriving through Outlook')
  const { data: replyC } = await supabase.from('email_replies').insert({
    contact_id: ids.contact, from_email: TEST_EMAIL, subject: 'Re: QA',
    body: 'Please remove me from your list.', source: 'outlook',
    conversation_id: 'conv-qa-automation-C', internet_message_id: '<qa-auto-c@verify.local>',
    match_status: 'auto_matched', ai_intent: 'unsubscribe', is_auto_reply: false,
    received_at: new Date().toISOString(), processed: false,
  }).select('id').single()
  ids.replies.push(replyC.id)

  const { data: contactAfter } = await supabase.from('contacts')
    .select('subscription_status, unsubscribed_at').eq('id', ids.contact).single()
  const unsubscribed =
    contactAfter.unsubscribed_at !== null ||
    String(contactAfter.subscription_status ?? '').toLowerCase().includes('unsub')
  check('contact unsubscribed by the trigger', unsubscribed, JSON.stringify(contactAfter))
} catch (err) {
  console.error('\nERROR:', err?.message || err)
  fail++
} finally {
  console.log('\nCleaning up…')
  await teardownFixture()
  for (const id of ids.replies) await supabase.from('email_replies').delete().eq('id', id)
  await supabase.from('email_replies').delete().eq('from_email', TEST_EMAIL)
  await supabase.from('email_sends').delete().eq('recipient_email', TEST_EMAIL)
  if (ids.contact) {
    await supabase.from('automation_enrollments').delete().eq('deal_id', ids.deal ?? '00000000-0000-0000-0000-000000000000')
    await supabase.from('deals').delete().eq('contact_id', ids.contact)
    await supabase.from('contacts').delete().eq('id', ids.contact)
  }
  await supabase.from('contacts').delete().eq('email', TEST_EMAIL)
  await supabase.from('automations').delete().like('name', 'QA Outlook Verify %')

  const counts = {}
  for (const [k, q] of Object.entries({
    contacts: supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('email', TEST_EMAIL),
    replies: supabase.from('email_replies').select('id', { count: 'exact', head: true }).eq('from_email', TEST_EMAIL),
    sends: supabase.from('email_sends').select('id', { count: 'exact', head: true }).eq('recipient_email', TEST_EMAIL),
    automations: supabase.from('automations').select('id', { count: 'exact', head: true }).like('name', 'QA Outlook Verify %'),
  })) counts[k] = (await q).count

  console.log('  ' + Object.entries(counts).map(([k, v]) => `${k} left: ${v}`).join(', '))
  const clean = Object.values(counts).every((v) => v === 0)
  console.log(clean ? '  Cleanup verified clean.' : '  !! RESIDUE LEFT')
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail === 0 && clean ? 0 : 1)
}
