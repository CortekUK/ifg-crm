/**
 * Fill in the sender's name on replies that arrived before it was captured.
 *
 * QA-31 Bug 1: `from_name` was null on every reply in the table (0 of 38),
 * because the inbound handler read the name from the webhook payload's
 * `event.data.from` — which is only ever the bare address. The display name is
 * in the fetched message's `From:` header. Verified against a real inbound:
 * top-level `from` is `jadenn.10futbol@gmail.com`, while `headers.from` is
 * `"Jaden Lagunas" <jadenn.10futbol@gmail.com>`.
 *
 * The deployed resend-inbound now reads the header, so new replies carry a
 * name. This repairs the existing ones, which is what Smart Match's
 * similar-name scoring needs in order to be testable at all.
 *
 * Matching is by RFC Message-Id, which both sides store, so a reply can only
 * ever be paired with the exact message it came from.
 *
 * Writes `from_name` and nothing else. The triggers on email_replies fire on
 * INSERT and on contact_id, so nothing is emailed and no enrolment changes.
 *
 * Usage: node scripts/backfill-reply-sender-names.mjs [--apply]
 * Without --apply it prints what it would write and changes nothing.
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const APPLY = process.argv.includes('--apply')
const RESEND_KEY = process.env.RESEND_API_KEY
if (!RESEND_KEY) {
  console.error('RESEND_API_KEY missing from .env')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

/** "Name <addr>" → Name. Mirrors parseEmailAddress in the edge function. */
function displayName(from) {
  if (!from || !from.includes('<')) return null
  const m = from.trim().match(/^"?([^"<]*?)"?\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/)
  return m?.[1]?.trim() || null
}

async function resend(path) {
  const res = await fetch(`https://api.resend.com/${path}`, {
    headers: { Authorization: `Bearer ${RESEND_KEY}` },
  })
  if (!res.ok) throw new Error(`Resend ${path} → ${res.status} ${await res.text()}`)
  return res.json()
}

// Replies with no name yet, keyed by Message-Id.
const { data: replies, error } = await supabase
  .from('email_replies')
  .select('id, message_id, from_email, from_name, received_at')
  .is('from_name', null)
  .not('message_id', 'is', null)

if (error) {
  console.error('Could not read replies:', error.message)
  process.exit(1)
}
console.log(`${replies.length} repl${replies.length === 1 ? 'y' : 'ies'} with no sender name`)

const byMessageId = new Map(replies.map((r) => [r.message_id, r]))

// Walk the received list until we run out, or until nothing is left to match.
let cursor = null
let scanned = 0
const found = []
while (byMessageId.size > 0) {
  const page = await resend(`emails/receiving${cursor ? `?after=${encodeURIComponent(cursor)}` : ''}`)
  const items = page.data ?? []
  if (items.length === 0) break
  scanned += items.length

  for (const item of items) {
    const reply = byMessageId.get(item.message_id)
    if (!reply) continue
    const full = await resend(`emails/receiving/${item.id}`)
    const headers = {}
    for (const [k, v] of Object.entries(full.headers ?? {})) {
      headers[k.toLowerCase()] = Array.isArray(v) ? v.join(' ') : (v ?? '')
    }
    const name = displayName(headers.from) || displayName(full.from)
    byMessageId.delete(item.message_id)
    if (name) found.push({ id: reply.id, email: reply.from_email, name })
  }

  if (!page.has_more) break
  cursor = items[items.length - 1]?.id
  if (!cursor) break
}

console.log(`scanned ${scanned} received email(s) at Resend; ${found.length} name(s) recovered`)
for (const f of found) console.log(`  ${f.email.padEnd(34)} → ${JSON.stringify(f.name)}`)
if (byMessageId.size) {
  console.log(`  (${byMessageId.size} repl${byMessageId.size === 1 ? 'y' : 'ies'} had no match at Resend — older than its retention, most likely)`)
}

if (!APPLY) {
  console.log('\nDry run. Re-run with --apply to write these.')
  process.exit(0)
}

let written = 0
for (const f of found) {
  const { error: e } = await supabase.from('email_replies').update({ from_name: f.name }).eq('id', f.id)
  if (e) console.error(`  failed on ${f.id}: ${e.message}`)
  else written++
}
console.log(`\nwrote ${written} sender name(s)`)
