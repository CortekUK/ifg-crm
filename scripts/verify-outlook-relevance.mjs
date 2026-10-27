// Offline verification of the Outlook relevance filter.
//
// Runs the REAL lib/outlook/relevance.ts against a fake database and a stubbed
// OpenAI, so it needs no .env and touches nothing live. Every case is a shape
// of mail a connected mailbox actually receives: login codes, sign-in alerts,
// promotions, a player's reply, a parent's first enquiry.
//
//   node scripts/verify-outlook-relevance.mjs
import { compileRenderer } from './_compile-renderer.mjs'

const { decideRelevance } = compileRenderer(['lib/outlook/relevance.ts']).load('outlook/relevance.js')

const MAILBOX = 'nathan@theinternationalfootballgroup.com'
const CONTACTS = new Set(['player.one@gmail.com', 'mum.of.player@hotmail.com'])
const CRM_CONVERSATIONS = new Set(['conv-crm'])

// The AI's answer for the next call, and how many calls were made.
let aiAnswer = 'BUSINESS'
let aiCalls = 0
process.env.OPENAI_API_KEY = 'test-key'
globalThis.fetch = async () => {
  aiCalls++
  if (aiAnswer === 'FAIL') return { ok: false, json: async () => ({}) }
  return { ok: true, json: async () => ({ choices: [{ message: { content: aiAnswer } }] }) }
}

function fakeSupabase() {
  const query = (table) => {
    const filters = {}
    const chain = {
      select: () => chain,
      eq: (col, val) => ((filters[col] = val), chain),
      not: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({
        data:
          (table === 'email_threads' || table === 'email_sends') &&
          CRM_CONVERSATIONS.has(filters.conversation_id)
            ? { id: 'x' }
            : null,
      }),
    }
    return chain
  }
  return {
    from: query,
    rpc: async (fn, { p_email }) => {
      if (fn === 'is_staff_email') {
        return { data: /@(macclesfieldfc\.com|theinternationalfootballgroup\.com)$/.test(p_email) }
      }
      if (fn === 'resolve_contact_by_email') {
        return { data: CONTACTS.has(p_email) ? [{ contact_id: 'c1', match_kind: 'player' }] : [] }
      }
      return { data: null }
    },
  }
}

let pass = 0
let fail = 0

async function expect(name, mail, want, opts = {}) {
  aiAnswer = opts.ai ?? 'BUSINESS'
  const callsBefore = aiCalls
  const from = mail.from
  const direction = mail.direction ?? 'inbound'
  const to = mail.to ?? [MAILBOX]
  const message = {
    id: `m-${Math.random()}`,
    conversationId: mail.conversationId ?? `conv-${Math.random()}`,
    subject: mail.subject,
    from: { emailAddress: { address: from, name: mail.name ?? null } },
    toRecipients: to.map((address) => ({ emailAddress: { address } })),
    ccRecipients: (mail.cc ?? []).map((address) => ({ emailAddress: { address } })),
    internetMessageHeaders: mail.headers,
  }
  const counterparty = direction === 'inbound' ? from : to[0]
  const participants = [from, ...to, ...(mail.cc ?? [])].filter((a) => a !== MAILBOX)
  const result = await decideRelevance(fakeSupabase(), {
    mailboxUserId: 'u1',
    message,
    direction,
    counterparty,
    participants,
    text: mail.text ?? '',
    loadHeaders: async () => mail.lazyHeaders ?? [],
  })
  const got = `${result.keep ? 'keep' : 'drop'}:${result.reason}`
  const ok = got === want && (opts.aiCalled === undefined || opts.aiCalled === aiCalls > callsBefore)
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name} — ${got}${ok ? '' : ` (wanted ${want})`}`)
  if (ok) pass++
  else fail++
}

console.log('\nPersonal mail — must never be stored')
await expect('Instagram login code', { from: 'security@mail.instagram.com', subject: '123456 is your Instagram code', text: 'Someone tried to log in.' }, 'drop:otp', { aiCalled: false })
await expect('Generic OTP', { from: 'info@somebank.co.uk', subject: 'Your one-time passcode', text: '' }, 'drop:otp', { aiCalled: false })
await expect('Code only in the body', { from: 'hello@randomapp.io', subject: 'Welcome back', text: 'Your verification code is 449201. It expires in 10 minutes.' }, 'drop:otp', { aiCalled: false })
await expect('Microsoft sign-in alert', { from: 'account-security-noreply@accountprotection.microsoft.com', subject: 'Microsoft account unusual sign-in activity', text: '' }, 'drop:account_security', { aiCalled: false })
await expect('Password reset', { from: 'support@someservice.com', subject: 'Reset your password', text: '' }, 'drop:account_security', { aiCalled: false })
await expect('New device login', { from: 'team@tool.com', subject: 'New login to your account', text: '' }, 'drop:account_security', { aiCalled: false })
await expect('Facebook notification', { from: 'notification@facebookmail.com', subject: 'You have 3 new notifications', text: '' }, 'drop:consumer_service', { aiCalled: false })
await expect('Amazon order', { from: 'shipment-tracking@amazon.co.uk', subject: 'Your order has been dispatched', text: '' }, 'drop:consumer_service', { aiCalled: false })
await expect('noreply robot', { from: 'no-reply@godaddy.com', subject: 'Renewal reminder', text: '' }, 'drop:automated_sender', { aiCalled: false })
await expect('Newsletter by footer', { from: 'hello@brand.com', subject: '50% off this weekend', text: 'Big sale! Manage your preferences or unsubscribe here.' }, 'drop:bulk_mail', { aiCalled: false })
await expect('Promotion by headers (fetched lazily)', { from: 'sarah@shop.example', subject: 'A little something for you', text: 'Hi there', lazyHeaders: [{ name: 'List-Unsubscribe', value: '<mailto:u@shop.example>' }] }, 'drop:bulk_mail', { aiCalled: false })
await expect('Precedence: bulk', { from: 'events@venue.example', subject: 'This month', text: 'x', headers: [{ name: 'Precedence', value: 'bulk' }] }, 'drop:bulk_mail', { aiCalled: false })
await expect('Unknown human, AI says personal', { from: 'landlord.dave@gmail.com', subject: 'Rent for November', text: 'Hi, just a reminder rent is due Friday.' }, 'drop:ai_personal', { ai: 'PERSONAL', aiCalled: true })
await expect('Colleague only CC\'d on a promo', { from: 'deals@shop.example', subject: 'Offer for your team', text: 'x', cc: ['jake@theinternationalfootballgroup.com'] }, 'drop:ai_personal', { ai: 'PERSONAL', aiCalled: true })

console.log('\nIFG business — must never be lost')
await expect('Player reply', { from: 'player.one@gmail.com', subject: 'Re: Gap Year 2026', text: 'Yes please send details' }, 'keep:contact', { aiCalled: false })
await expect('Parent, even with a "code" subject', { from: 'mum.of.player@hotmail.com', subject: 'Verification code for the portal?', text: '' }, 'keep:contact', { aiCalled: false })
await expect('Contact only in CC', { from: 'coach@school.edu', subject: 'Trials', text: '', cc: ['player.one@gmail.com'] }, 'keep:contact', { aiCalled: false })
await expect('Colleague writing', { from: 'lindsay@macclesfieldfc.com', subject: 'Kit order', text: '' }, 'keep:colleague', { aiCalled: false })
await expect('Website form notification', { from: 'noreply@theinternationalfootballgroup.com', subject: 'New enquiry', text: '' }, 'keep:colleague', { aiCalled: false })
await expect('Reply in a CRM conversation', { from: 'new.address@yahoo.com', subject: 'Re: Your application', text: 'see attached', conversationId: 'conv-crm' }, 'keep:crm_conversation', { aiCalled: false })
await expect('Calendly booking', { from: 'notifications@calendly.com', subject: 'New Event: Call with Sam', text: '' }, 'keep:business_service', { aiCalled: false })
await expect('Parent\'s first enquiry', { from: 'new.parent@gmail.com', name: 'Ahmed Khan', subject: 'Scholarship for my son', text: 'My son is 17 and plays as a striker. How do the US scholarships work?' }, 'keep:ai_business', { aiCalled: true })
await expect('University reply about a locked account', { from: 'cmwright1@lancashire.ac.uk', subject: 'RE: ACCOUNT LOCKED - DO NOT IGNORE - Have you Submitted your Visa Application', text: 'Please submit by Friday.' }, 'keep:ai_business', { aiCalled: true })
await expect('Google Drive share', { from: 'drive-shares-dm-noreply@google.com', subject: "Spreadsheet shared with you: 'Weekly Content Plan'", text: '' }, 'keep:ai_business', { aiCalled: true })
await expect('Supplier invoice', { from: 'accounts@coachhire.co.uk', subject: 'Invoice 2231 - summer residency transport', text: 'Please find attached.' }, 'keep:ai_business', { aiCalled: true })
await expect('AI unavailable keeps the human', { from: 'someone@club.example', subject: 'Quick question', text: 'Hi Nathan' }, 'keep:ai_unavailable', { ai: 'FAIL', aiCalled: true })
await expect('Outbound to a player', { direction: 'outbound', from: MAILBOX, to: ['player.one@gmail.com'], subject: 'Following up', text: '' }, 'keep:contact', { aiCalled: false })
await expect('Outbound personal', { direction: 'outbound', from: MAILBOX, to: ['my.sister@gmail.com'], subject: 'Dinner sunday?', text: 'Are you free?' }, 'drop:ai_personal', { ai: 'PERSONAL', aiCalled: true })

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
