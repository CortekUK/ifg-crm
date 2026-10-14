// Seeds a realistic Outlook conversation so the Mailbox screen can be shown
// with content before a real mailbox is connected.
//
// THIS IS DEMO DATA. Say so on camera, or run --cleanup straight afterwards.
// Everything it writes is tied to the address below and removed by --cleanup.
//
//   node scripts/demo-outlook-thread.mjs            seed it
//   node scripts/demo-outlook-thread.mjs --cleanup  remove every trace
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

// Change this to your own address if you want the demo to show your name.
const PLAYER_EMAIL = process.env.DEMO_EMAIL || 'hamna+testing123@gmail.com'
const PLAYER_FIRST = 'Demo'
const PLAYER_LAST = 'Player'
const CONVERSATION = 'demo-outlook-thread-0001'
const MAILBOX = 'crmtest@macclesfieldfc.com'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

async function cleanup() {
  await supabase.from('email_threads').delete().eq('conversation_id', CONVERSATION)
  await supabase.from('email_replies').delete().eq('conversation_id', CONVERSATION)
  await supabase.from('email_sends').delete().eq('conversation_id', CONVERSATION)
  await supabase.from('email_replies').delete().eq('from_email', PLAYER_EMAIL)
  await supabase.from('email_sends').delete().eq('recipient_email', PLAYER_EMAIL)
  await supabase.from('contacts').delete().eq('email', PLAYER_EMAIL)
  const { count } = await supabase
    .from('email_threads').select('id', { count: 'exact', head: true })
    .eq('conversation_id', CONVERSATION)
  console.log(`Cleaned up. Threads remaining for this demo: ${count}`)
}

if (process.argv.includes('--cleanup')) {
  await cleanup()
  process.exit(0)
}

// Start from a clean slate so re-running never doubles up.
await cleanup()

const { data: owner } = await supabase
  .from('profiles').select('id, email')
  .eq('email', 'superadmin@theinternationalfootballgroup.com').single()

const { data: contact } = await supabase
  .from('contacts')
  .insert({ first_name: PLAYER_FIRST, last_name: PLAYER_LAST, email: PLAYER_EMAIL, source: 'manual' })
  .select('id').single()

const minutesAgo = (n) => new Date(Date.now() - n * 60_000).toISOString()

// Outbound: the pitch the recruiter sent.
await supabase.from('email_sends').insert({
  recipient_email: PLAYER_EMAIL,
  recipient_contact_id: contact.id,
  subject: 'UK Gap Year Programme 2027 — places open',
  body_text:
    `Hi ${PLAYER_FIRST},\n\nThanks for your interest in IFG. We have places open on the UK Gap Year ` +
    `Programme for 2027 — football development alongside an academic pathway, based at Macclesfield FC.\n\n` +
    `Would you like me to send the brochure and the application details?\n\nBest,\nIFG Recruitment`,
  status: 'sent',
  sent_at: minutesAgo(180),
  mailbox_user_id: owner.id,
  conversation_id: CONVERSATION,
  internet_message_id: '<demo-outbound-1@ifg.local>',
  from_email: MAILBOX,
  source: 'outlook',
})

// Inbound: the player's reply, which is what creates the CRM signal.
await supabase.from('email_replies').insert({
  contact_id: contact.id,
  from_email: PLAYER_EMAIL,
  from_name: `${PLAYER_FIRST} ${PLAYER_LAST}`,
  subject: 'Re: UK Gap Year Programme 2027 — places open',
  body: `Hi,\n\nYes please — I'm very interested. Could you send the brochure and let me know what the fees are?\n\nThanks,\n${PLAYER_FIRST}`,
  body_preview: "Yes please — I'm very interested. Could you send the brochure and let me know what the fees are?",
  match_status: 'auto_matched',
  ai_intent: 'positive',
  is_auto_reply: false,
  read: false,
  received_at: minutesAgo(45),
  mailbox_user_id: owner.id,
  conversation_id: CONVERSATION,
  internet_message_id: '<demo-inbound-1@ifg.local>',
  graph_message_id: 'demo-graph-inbound-1',
  source: 'outlook',
  processed: true,
})

await supabase.from('email_threads').insert({
  conversation_id: CONVERSATION,
  mailbox_user_id: owner.id,
  subject: 'UK Gap Year Programme 2027 — places open',
  last_message_at: minutesAgo(45),
  last_message_preview: "Yes please — I'm very interested. Could you send the brochure and let me know what the fees are?",
  last_message_from: PLAYER_EMAIL,
  last_message_direction: 'inbound',
  unread_count: 1,
  message_count: 2,
  contact_id: contact.id,
  counterparty_email: PLAYER_EMAIL,
  counterparty_name: `${PLAYER_FIRST} ${PLAYER_LAST}`,
  is_crm_related: true,
  source: 'outlook',
})

console.log(`
Seeded one conversation in the Mailbox:
  ${PLAYER_FIRST} ${PLAYER_LAST} <${PLAYER_EMAIL}>
  "UK Gap Year Programme 2027 — places open"  (2 messages, 1 unread)

Sign in as superadmin@theinternationalfootballgroup.com and open Outlook > Mailbox.

THIS IS DEMO DATA on the live database.
Remove it when you are done:  node scripts/demo-outlook-thread.mjs --cleanup
`)
