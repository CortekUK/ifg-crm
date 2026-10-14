// Live verification of the Outlook ingest path.
//
// Runs the REAL lib/outlook/ingest.ts against the live database with synthetic
// Microsoft Graph messages, then deletes everything it made. There is one
// database and the team is using it, so every row this creates is tied to the
// test address below and removed in the finally block — including on failure.
//
//   node scripts/verify-outlook-ingest.mjs
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { compileRenderer } from './_compile-renderer.mjs'

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const TEST_EMAIL = 'hamna+testing123@gmail.com'
const STRANGER_EMAIL = 'hamna+testing123-stranger@gmail.com'
const MAILBOX_EMAIL = 'qa-outlook-verify@macclesfieldfc.com'
const TAG = 'OUTLOOK-VERIFY'

const { ingestMessage } = compileRenderer(['lib/outlook/ingest.ts']).load('outlook/ingest.js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (ok) pass++
  else fail++
}

function graphMessage(overrides = {}) {
  return {
    id: `AAMk-verify-${Math.random().toString(36).slice(2)}`,
    internetMessageId: `<${Math.random().toString(36).slice(2)}@verify.local>`,
    conversationId: `conv-verify-${Math.random().toString(36).slice(2)}`,
    subject: `${TAG} subject`,
    bodyPreview: 'preview',
    body: { contentType: 'text', content: 'Yes I am very interested, please send details.' },
    from: { emailAddress: { address: TEST_EMAIL, name: 'QA Outlook Verify' } },
    toRecipients: [{ emailAddress: { address: MAILBOX_EMAIL, name: 'Mailbox' } }],
    receivedDateTime: new Date().toISOString(),
    isRead: false,
    isDraft: false,
    ...overrides,
  }
}

let contactId = null
let userId = null
const createdReplyIds = []
const createdSendIds = []
const createdConversationIds = []

try {
  // A real staff profile to own the synthetic mailbox. Read-only: we never
  // modify the profile, only reference its id.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email')
    .in('role', ['admin', 'super_admin'])
    .eq('is_active', true)
    .limit(1)
    .single()
  userId = profile.id
  console.log(`\nMailbox owner for the test: ${profile.email}\n`)

  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .insert({ first_name: 'QA', last_name: 'Outlook Verify', email: TEST_EMAIL })
    .select('id')
    .single()
  if (contactError) throw contactError
  contactId = contact.id

  const mailbox = { userId, mailboxEmail: MAILBOX_EMAIL }

  // ── 1. inbound from a known contact → matched ──────────────────────────
  console.log('1. Inbound reply from a known contact')
  const known = graphMessage()
  createdConversationIds.push(known.conversationId)
  const r1 = await ingestMessage(supabase, mailbox, known)
  check('ingest reports inserted', r1.status === 'inserted', r1.status + (r1.reason ? `: ${r1.reason}` : ''))
  createdReplyIds.push(r1.replyId)

  const { data: reply1 } = await supabase
    .from('email_replies')
    .select('contact_id, match_status, source, mailbox_user_id, conversation_id, ai_intent, is_auto_reply, body')
    .eq('id', r1.replyId)
    .single()
  check('matched to the contact', reply1.contact_id === contactId)
  check('match_status = auto_matched', reply1.match_status === 'auto_matched', reply1.match_status)
  check("source = 'outlook'", reply1.source === 'outlook', reply1.source)
  check('mailbox_user_id set', reply1.mailbox_user_id === userId)
  check('body captured', (reply1.body || '').includes('very interested'))
  check('is_auto_reply false for a real reply', reply1.is_auto_reply === false)
  console.log(`     ai_intent = ${reply1.ai_intent ?? 'null'}`)

  // ── 2. idempotency ────────────────────────────────────────────────────
  console.log('\n2. Same message delivered twice (notification + sweep overlap)')
  const r2 = await ingestMessage(supabase, mailbox, known)
  check('second delivery deduped', r2.status === 'duplicate', r2.status)
  const { count: dupCount } = await supabase
    .from('email_replies')
    .select('id', { count: 'exact', head: true })
    .eq('internet_message_id', known.internetMessageId)
  check('exactly one row stored', dupCount === 1, `count=${dupCount}`)

  // ── 3. unknown sender → unmatched ─────────────────────────────────────
  console.log('\n3. Inbound from an address the CRM has never seen')
  const stranger = graphMessage({
    from: { emailAddress: { address: STRANGER_EMAIL, name: 'Nobody' } },
    body: { contentType: 'text', content: 'Who is this?' },
  })
  createdConversationIds.push(stranger.conversationId)
  const r3 = await ingestMessage(supabase, mailbox, stranger)
  createdReplyIds.push(r3.replyId)
  const { data: reply3 } = await supabase
    .from('email_replies')
    .select('contact_id, match_status')
    .eq('id', r3.replyId)
    .single()
  check('stored, not dropped', r3.status === 'inserted', r3.status)
  check('contact_id null', reply3.contact_id === null)
  check('match_status = unmatched', reply3.match_status === 'unmatched', reply3.match_status)

  // ── 4. auto-reply detection (QA-28 Bug 3) ─────────────────────────────
  console.log('\n4. Out-of-office autoresponder')
  const ooo = graphMessage({
    subject: 'Automatic reply: Out of office',
    body: { contentType: 'text', content: 'I am on leave until Monday.' },
    internetMessageHeaders: [{ name: 'Auto-Submitted', value: 'auto-replied' }],
  })
  createdConversationIds.push(ooo.conversationId)
  const r4 = await ingestMessage(supabase, mailbox, ooo)
  createdReplyIds.push(r4.replyId)
  const { data: reply4 } = await supabase
    .from('email_replies')
    .select('is_auto_reply')
    .eq('id', r4.replyId)
    .single()
  check('flagged is_auto_reply (so the deal is left alone)', reply4.is_auto_reply === true)

  // ── 5. HTML-only body (QA-28 "watch for") ─────────────────────────────
  console.log('\n5. HTML-only message body')
  const html = graphMessage({
    body: { contentType: 'html', content: '<html><body><p>Interested, thanks!</p></body></html>' },
  })
  createdConversationIds.push(html.conversationId)
  const r5 = await ingestMessage(supabase, mailbox, html)
  createdReplyIds.push(r5.replyId)
  const { data: reply5 } = await supabase
    .from('email_replies')
    .select('body, html_body')
    .eq('id', r5.replyId)
    .single()
  check('body is not empty', (reply5.body || '').trim().length > 0, JSON.stringify(reply5.body))
  check('html retained', (reply5.html_body || '').includes('<p>'))

  // ── 6. outbound (Sent Items) → email_sends, not a reply ───────────────
  console.log('\n6. Outbound message found in Sent Items')
  const sent = graphMessage({
    from: { emailAddress: { address: MAILBOX_EMAIL, name: 'Mailbox' } },
    toRecipients: [{ emailAddress: { address: TEST_EMAIL, name: 'QA' } }],
    body: { contentType: 'text', content: 'Hello, here are the details.' },
    sentDateTime: new Date().toISOString(),
  })
  createdConversationIds.push(sent.conversationId)
  const r6 = await ingestMessage(supabase, mailbox, sent)
  check('recorded as a send', r6.status === 'inserted' && !!r6.sendId, JSON.stringify(r6))
  if (r6.sendId) createdSendIds.push(r6.sendId)
  const { data: send6 } = await supabase
    .from('email_sends')
    .select('recipient_email, recipient_contact_id, mailbox_user_id, source')
    .eq('id', r6.sendId)
    .single()
  check('recipient is the contact', send6.recipient_contact_id === contactId)
  check('attributed to the mailbox', send6.mailbox_user_id === userId)
  const { count: wrongTable } = await supabase
    .from('email_replies')
    .select('id', { count: 'exact', head: true })
    .eq('internet_message_id', sent.internetMessageId)
  check('NOT filed as an inbound reply', wrongTable === 0, `found ${wrongTable}`)

  // ── 7. threads ────────────────────────────────────────────────────────
  console.log('\n7. Conversation threads')
  const { data: thread1 } = await supabase
    .from('email_threads')
    .select('*')
    .eq('conversation_id', known.conversationId)
    .single()
  check('thread created for the matched conversation', !!thread1)
  check('is_crm_related true', thread1.is_crm_related === true)
  check('linked to the contact', thread1.contact_id === contactId)
  check('unread counted', thread1.unread_count === 1, `unread=${thread1.unread_count}`)

  const { data: thread3 } = await supabase
    .from('email_threads')
    .select('is_crm_related, counterparty_email')
    .eq('conversation_id', stranger.conversationId)
    .single()
  check('stranger thread is_crm_related false', thread3.is_crm_related === false)
  check('stranger thread keeps the address', thread3.counterparty_email === STRANGER_EMAIL)

  // second message in the same conversation should extend, not duplicate
  const followUp = graphMessage({
    conversationId: known.conversationId,
    body: { contentType: 'text', content: 'Also, when does it start?' },
  })
  const r7 = await ingestMessage(supabase, mailbox, followUp)
  createdReplyIds.push(r7.replyId)
  const { data: threadAfter } = await supabase
    .from('email_threads')
    .select('message_count, unread_count')
    .eq('conversation_id', known.conversationId)
    .single()
  check('message_count incremented', threadAfter.message_count === 2, `count=${threadAfter.message_count}`)
  const { count: threadRows } = await supabase
    .from('email_threads')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', known.conversationId)
  check('still one thread row', threadRows === 1, `rows=${threadRows}`)

  // ── 8. an older message must not rewrite the thread summary ───────────
  console.log('\n8. Out-of-order replay (the catch-up sweep replays history)')
  const old = graphMessage({
    conversationId: known.conversationId,
    subject: `${TAG} OLD`,
    body: { contentType: 'text', content: 'This is an old message.' },
    receivedDateTime: new Date(Date.now() - 86_400_000 * 5).toISOString(),
  })
  const r8 = await ingestMessage(supabase, mailbox, old)
  createdReplyIds.push(r8.replyId)
  const { data: threadOld } = await supabase
    .from('email_threads')
    .select('subject, message_count')
    .eq('conversation_id', known.conversationId)
    .single()
  check('older message did not rewrite the subject', threadOld.subject !== `${TAG} OLD`, threadOld.subject)
  check('but was still counted', threadOld.message_count === 3, `count=${threadOld.message_count}`)

  // ── 9. drafts ignored ─────────────────────────────────────────────────
  console.log('\n9. Draft message')
  const draft = graphMessage({ isDraft: true })
  const r9 = await ingestMessage(supabase, mailbox, draft)
  check('draft skipped', r9.status === 'skipped' && r9.reason === 'draft', JSON.stringify(r9))
} catch (err) {
  console.error('\nERROR:', err?.message || err)
  fail++
} finally {
  // ── cleanup ───────────────────────────────────────────────────────────
  console.log('\nCleaning up test rows…')
  for (const cid of createdConversationIds) {
    await supabase.from('email_threads').delete().eq('conversation_id', cid)
    await supabase.from('email_replies').delete().eq('conversation_id', cid)
    await supabase.from('email_sends').delete().eq('conversation_id', cid)
  }
  for (const id of createdReplyIds.filter(Boolean)) {
    await supabase.from('email_replies').delete().eq('id', id)
  }
  for (const id of createdSendIds.filter(Boolean)) {
    await supabase.from('email_sends').delete().eq('id', id)
  }
  if (contactId) {
    await supabase.from('deals').delete().eq('contact_id', contactId)
    await supabase.from('email_replies').delete().eq('contact_id', contactId)
    await supabase.from('email_sends').delete().eq('recipient_contact_id', contactId)
    await supabase.from('contacts').delete().eq('id', contactId)
  }
  // Belt and braces: anything left anywhere carrying the test addresses.
  for (const addr of [TEST_EMAIL, STRANGER_EMAIL]) {
    await supabase.from('email_replies').delete().eq('from_email', addr)
    await supabase.from('email_sends').delete().eq('recipient_email', addr)
    await supabase.from('contacts').delete().eq('email', addr)
  }

  const { count: leftContacts } = await supabase
    .from('contacts').select('id', { count: 'exact', head: true }).eq('email', TEST_EMAIL)
  const { count: leftReplies } = await supabase
    .from('email_replies').select('id', { count: 'exact', head: true }).in('from_email', [TEST_EMAIL, STRANGER_EMAIL])
  const { count: leftSends } = await supabase
    .from('email_sends').select('id', { count: 'exact', head: true }).eq('recipient_email', TEST_EMAIL)
  const { count: leftThreads } = await supabase
    .from('email_threads').select('id', { count: 'exact', head: true }).in('counterparty_email', [TEST_EMAIL, STRANGER_EMAIL])

  console.log(`  contacts left: ${leftContacts}, replies left: ${leftReplies}, sends left: ${leftSends}, threads left: ${leftThreads}`)
  const clean = !leftContacts && !leftReplies && !leftSends && !leftThreads
  console.log(clean ? '  Cleanup verified clean.' : '  !! RESIDUE LEFT — investigate.')

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail === 0 && clean ? 0 : 1)
}
