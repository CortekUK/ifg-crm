// Run the Outlook relevance filter over mail stored BEFORE the filter existed.
//
// ingest.ts deliberately skips the filter for a message already stored, and
// migration 267's backfill could only read subjects and senders in SQL. So old
// promotions stayed in the mailbox for good, and disconnecting and reconnecting
// could not clear them: the re-sweep finds each one already stored.
//
// decideRelevance cannot simply be called here. Its "crm_conversation" rule
// finds the thread being judged and keeps every one of them. So the keep rules
// that apply to a stored thread are spelled out below, then the REAL rules and
// the REAL AI check are used.
//
// Hides, never deletes. Dry run unless --apply is passed. Undo with
//   node scripts/apply-migration.mjs supabase/rollbacks/268_down.sql
//
//   node scripts/refilter-stored-outlook.mjs --mailbox=someone@example.com
//   node scripts/refilter-stored-outlook.mjs --mailbox=someone@example.com --subjects
//   node scripts/refilter-stored-outlook.mjs --mailbox=someone@example.com --apply
//
// Read the dry run before applying: the AI check is good on promotions and less
// sure on a real person selling something. --keep=a@x.com,b@y.com protects
// senders it got wrong, and any reply or forward is left alone as a conversation.
import fs from 'node:fs'
import { compileRenderer } from './_compile-renderer.mjs'

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
const mailbox = arg('mailbox')?.toLowerCase()
const apply = process.argv.includes('--apply')
const showSubjects = process.argv.includes('--subjects')
const keepSenders = new Set((arg('keep') ?? '').toLowerCase().split(',').filter(Boolean))
if (!mailbox) {
  console.error('usage: node scripts/refilter-stored-outlook.mjs --mailbox=<email> [--subjects] [--apply]')
  process.exit(1)
}

const compiled = compileRenderer(['lib/outlook/relevance.ts', 'lib/utils/trimQuotedContent.ts'])
const { classifyBusinessRelevance } = compiled.load('outlook/relevance.js')
const { personalMarker } = compiled.load('outlook/relevance-rules.js')
const { VENDOR_EXCEPT_DOMAINS } = compiled.load('outlook/classify-sender.js')
const { trimQuotedContent } = compiled.load('utils/trimQuotedContent.js')

async function sql(query, readOnly = true) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_ID}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, read_only: readOnly }),
    },
  )
  const text = await res.text()
  if (!res.ok) throw new Error(`query failed (${res.status}): ${text}`)
  return JSON.parse(text)
}

const literal = (s) => `'${String(s).replace(/'/g, "''")}'`

const [owner] = await sql(
  `select user_id from outlook_credentials where lower(mailbox_email) = ${literal(mailbox)}`,
)
if (!owner) {
  console.error(`no connected mailbox for ${mailbox}`)
  process.exit(1)
}

// Only threads nobody has claimed. One with a contact, or one this mailbox has
// ever answered, is a conversation with a person and is not looked at.
const threads = await sql(`
  select t.id, t.conversation_id, t.category, lower(t.counterparty_email) as sender, t.counterparty_name as name, t.subject,
    (select r.body from email_replies r
      where r.conversation_id = t.conversation_id and r.mailbox_user_id = t.mailbox_user_id
      order by r.received_at desc limit 1) as body
  from email_threads t
  where t.mailbox_user_id = ${literal(owner.user_id)}
    and t.source = 'outlook'
    and t.contact_id is null
    and t.category in ('unknown', 'external')
    and not exists (
      select 1 from email_sends s
      where s.conversation_id = t.conversation_id and s.mailbox_user_id = t.mailbox_user_id
    )`)

const isBusinessService = (address) => {
  const domain = (address ?? '').split('@')[1] ?? ''
  return VENDOR_EXCEPT_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))
}

const hide = []
const kept = { protected: [], conversation: [], business_service: [], ai_business: [], ai_unavailable: [] }
for (const thread of threads) {
  if (keepSenders.has(thread.sender)) {
    kept.protected.push(thread)
    continue
  }
  if (isBusinessService(thread.sender)) {
    kept.business_service.push(thread)
    continue
  }
  const text = trimQuotedContent(thread.body ?? '')
  const marker = personalMarker({ counterparty: thread.sender, subject: thread.subject, text })
  if (marker) {
    hide.push({ ...thread, reason: marker })
    continue
  }
  const verdict = await classifyBusinessRelevance({
    direction: 'inbound',
    counterparty: thread.sender,
    counterpartyName: thread.name,
    subject: thread.subject,
    text,
  })
  if (verdict === 'personal' && /^\s*(re|fw|fwd)\s*:/i.test(thread.subject ?? '')) kept.conversation.push(thread)
  else if (verdict === 'personal') hide.push({ ...thread, reason: 'ai_personal' })
  else kept[verdict === 'business' ? 'ai_business' : 'ai_unavailable'].push(thread)
}

const line = (t) => `  ${t.sender}${showSubjects ? `  |  ${t.subject ?? ''}` : ''}`
console.log(`${mailbox}: ${threads.length} unclaimed threads looked at`)
console.log(`\nWOULD HIDE ${hide.length}`)
for (const t of [...hide].sort((a, b) => a.reason.localeCompare(b.reason) || a.sender.localeCompare(b.sender))) {
  console.log(`${t.reason.padEnd(18)}${line(t)}`)
}
for (const [reason, rows] of Object.entries(kept)) {
  console.log(`\nKEEP ${reason} ${rows.length}`)
  if (reason !== 'business_service') rows.forEach((t) => console.log(line(t)))
}

if (!apply) {
  console.log('\nDry run. Nothing was changed.')
  process.exit(0)
}
if (!hide.length) {
  console.log('\nNothing to hide.')
  process.exit(0)
}

// Same shape as 267: thread and its unclaimed replies, each with its previous
// value recorded, in one transaction.
const ids = hide.map((t) => `${literal(t.id)}::uuid`).join(',')
const [result] = await sql(
  `with picked as (
     select id, conversation_id, category from email_threads where id in (${ids})
   ), saved_threads as (
     insert into reclassified_personal_268 (source_table, row_id, previous_value)
     select 'email_threads', id, category from picked returning row_id
   ), replies as (
     select r.id, r.sender_kind from email_replies r join picked p on p.conversation_id = r.conversation_id
     where r.mailbox_user_id = ${literal(owner.user_id)} and r.contact_id is null and r.sender_kind in ('unknown', 'external')
   ), saved_replies as (
     insert into reclassified_personal_268 (source_table, row_id, previous_value)
     select 'email_replies', id, sender_kind from replies returning row_id
   ), set_threads as (
     update email_threads set category = 'personal' where id in (select id from picked) returning id
   ), set_replies as (
     update email_replies set sender_kind = 'personal' where id in (select id from replies) returning id
   )
   select (select count(*) from set_threads) as threads, (select count(*) from set_replies) as replies`,
  false,
)
console.log(`\nHidden: ${result.threads} threads, ${result.replies} replies. Undo with supabase/rollbacks/268_down.sql`)
