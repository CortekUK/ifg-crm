// Seeds unmatched emails so the Connect flow can be demonstrated.
//
// Each one is built to exercise a different path through the dialog:
//   1. a player writing from a second address  -> strong suggestion, save as secondary
//   2. a parent writing about their son        -> suggestion by surname
//   3. a supplier                              -> "not a contact, mark as external"
//   4. somebody with a common surname          -> several ranked candidates
//
// THIS IS DEMO DATA on the live database. Every row is tied to a
// hamna+testing address and removed by --cleanup.
//
//   node scripts/demo-unmatched-emails.mjs            seed
//   node scripts/demo-unmatched-emails.mjs --cleanup  remove
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const PREFIX = 'hamna+testing-unmatched'
const CONV = 'demo-unmatched'

// Written to look like the real thing: each sender resembles a player who has
// genuinely replied, so the ranked suggestions have something true to find.
const EMAILS = [
  {
    key: 'westin-mum',
    name: 'Sarah Horton',
    email: `${PREFIX}-horton@gmail.com`,
    subject: 'Re: Still interested, Westin?',
    body: "Hi James,\n\nSarah here, Westin's mum. Block C works for us. Could you confirm the deposit amount, and whether the fee covers the flights?\n\nThanks,\nSarah",
    intent: 'question',
    minutesAgo: 42,
  },
  {
    key: 'thato-second',
    name: 'Thato M',
    email: `${PREFIX}-thato@gmail.com`,
    subject: 'Re: University Brochure',
    body: "Hi Coach,\n\nSorry, replying from my other email — my school account blocks attachments. Could you resend the brochure here?\n\nThato",
    intent: 'question',
    minutesAgo: 95,
  },
  {
    key: 'brown-common',
    name: 'Chris Brown',
    email: `${PREFIX}-brown@gmail.com`,
    subject: 'Trial dates in October',
    body: "Hello,\n\nI saw the post about October trials. Are there places left for a 2008 player?\n\nChris",
    intent: 'positive',
    minutesAgo: 180,
  },
  {
    key: 'gym-supplier',
    name: 'Stealth Gym Bookings',
    email: `${PREFIX}-gym@gmail.com`,
    subject: 'Booking confirmed: Squad S&C session, 21 Oct',
    body: 'Hello,\n\nYour booking is confirmed.\n\nSession: Squad strength & conditioning (U23)\nDate: Wednesday 21 October, 10:00–11:30\nGroup size: 24\nReference: SG-48213\n\nStealth Gym, Macclesfield',
    intent: null,
    minutesAgo: 300,
  },
]

async function cleanup() {
  await supabase.from('email_threads').delete().like('conversation_id', `${CONV}%`)
  await supabase.from('email_replies').delete().like('from_email', `${PREFIX}%`)
  await supabase.from('contact_emails').delete().like('email', `${PREFIX}%`)
  const { count } = await supabase
    .from('email_replies').select('id', { count: 'exact', head: true }).like('from_email', `${PREFIX}%`)
  console.log(`Cleaned up. Demo rows remaining: ${count}`)
}

if (process.argv.includes('--cleanup')) { await cleanup(); process.exit(0) }

// Always start clean, so re-running never doubles up.
await cleanup()

// Owned by the signed-in admin so they appear under "My mailbox" as well as
// "All mailboxes" — otherwise the demo depends on which selector is chosen.
const { data: owner } = await supabase
  .from('profiles').select('id, full_name')
  .eq('email', 'superadmin@theinternationalfootballgroup.com').single()

for (const e of EMAILS) {
  const at = new Date(Date.now() - e.minutesAgo * 60_000).toISOString()
  const conversationId = `${CONV}-${e.key}`

  await supabase.from('email_replies').insert({
    contact_id: null,                 // the whole point: nobody is attached yet
    from_email: e.email,
    from_name: e.name,
    subject: e.subject,
    body: e.body,
    body_preview: e.body.split('\n').filter(Boolean)[1]?.slice(0, 140) ?? e.body.slice(0, 140),
    match_status: 'unmatched',
    sender_kind: 'unknown',
    ai_intent: e.intent,
    is_auto_reply: false,
    read: false,
    received_at: at,
    mailbox_user_id: owner.id,
    conversation_id: conversationId,
    internet_message_id: `<${conversationId}@demo.local>`,
    // Deliberately no graph_message_id: replying needs a real message in a
    // connected mailbox, and a fake id would fail at send time on camera.
    source: 'outlook',
    processed: true,
  })

  await supabase.from('email_threads').insert({
    conversation_id: conversationId,
    mailbox_user_id: owner.id,
    subject: e.subject,
    last_message_at: at,
    last_message_preview: e.body.split('\n').filter(Boolean)[1]?.slice(0, 140) ?? '',
    last_message_from: e.email,
    last_message_direction: 'inbound',
    unread_count: 1,
    message_count: 1,
    contact_id: null,
    counterparty_email: e.email,
    counterparty_name: e.name,
    is_crm_related: false,
    category: 'unknown',
    latest_intent: e.intent,
    participants: [{ email: e.email, name: e.name }],
    source: 'outlook',
  })
}

console.log(`
Seeded ${EMAILS.length} unmatched emails in ${owner.full_name}'s mailbox:

  Sarah Horton          — Westin's mum. Connect should suggest Westin Horton by surname.
  Thato M               — a second address for a player who already replied.
  Chris Brown           — a common surname, so several candidates rank together.
  Stealth Gym Bookings  — a supplier: demo "Not a contact — mark as external".

Open Outlook > Unmatched. Each row has a Connect button.

DEMO DATA on the live database.
Remove it with:  node scripts/demo-unmatched-emails.mjs --cleanup
`)
