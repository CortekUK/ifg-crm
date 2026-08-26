// End-to-end test of the inbound-reply pipeline, including the owner alert.
//
// Signs a synthetic `email.received` webhook exactly as Resend would and
// posts it at the DEPLOYED resend-inbound function, so this exercises the
// real code path — signature check, contact match, deal lookup, intent
// classification, owner resolution and the alert email — rather than a
// re-implementation that could drift from it.
//
//   node scripts/test-reply-alert.mjs --from you@gmail.com            (preview)
//   node scripts/test-reply-alert.mjs --from you@gmail.com --send      (fires)
//
// --from     the address the "player" replies from. Must belong to a contact
//            that has a deal, or there is no owner to alert.
// --send     actually post the webhook. WITHOUT THIS NOTHING IS SENT — the
//            script only reports who would be emailed. That default exists
//            because the alert goes to the deal's owner, which may well be a
//            colleague or the client rather than you, and a surprise test
//            email landing in their inbox is not recoverable.
// --cleanup  delete the email_replies row this created afterwards.
//
// Nothing is sent to the player: the only email produced is the internal
// alert to the deal owner.

import fs from 'node:fs'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

for (const l of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 ? process.argv[i + 1] : null
}
const FROM = arg('from')
const SEND = process.argv.includes('--send')
const CLEANUP = process.argv.includes('--cleanup')

if (!FROM) {
  console.error('Usage: node scripts/test-reply-alert.mjs --from <player@email> [--cleanup]')
  process.exit(1)
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// ---- who would be alerted, before we fire anything -------------------
const { data: contact } = await sb
  .from('contacts')
  .select('id, first_name, last_name, owner_id')
  .ilike('email', FROM)
  .maybeSingle()

if (!contact) {
  console.error(`No contact in the CRM with the email ${FROM}.`)
  console.error('Add one (with a deal) first, or use an address that already exists.')
  process.exit(1)
}

const { data: deal } = await sb
  .from('deals')
  .select('id, deal_owner_id')
  .eq('contact_id', contact.id)
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()

const ownerId = deal?.deal_owner_id ?? contact.owner_id ?? null
let owner = null
if (ownerId) {
  const { data } = await sb.from('profiles').select('full_name, email').eq('id', ownerId).maybeSingle()
  owner = data
}

console.log(`contact      : ${contact.first_name} ${contact.last_name}`)
console.log(`deal         : ${deal?.id ?? '(none)'}`)
console.log(`alert goes to: ${owner ? `${owner.full_name} <${owner.email}>` : 'NOBODY — no deal owner or contact owner set'}`)
if (!owner) {
  console.error('\nWith no owner the alert is skipped by design. Assign a deal owner and re-run.')
  process.exit(1)
}

if (!SEND) {
  console.log('\n--- PREVIEW ONLY, nothing sent ---')
  console.log(`Running with --send would post a test reply and email ${owner.email}.`)
  console.log('Make sure that inbox is one you want a test email to land in.')
  process.exit(0)
}

// ---- build and sign the webhook exactly as Resend does ---------------
const messageId = `<test-${Date.now()}@reply.local>`
const payload = JSON.stringify({
  type: 'email.received',
  created_at: new Date().toISOString(),
  data: {
    email_id: `test_${crypto.randomUUID()}`,
    from: `${contact.first_name} ${contact.last_name} <${FROM}>`,
    to: ['replies@reply.theinternationalfootballgroup.com'],
    subject: 'Re: Test — checking the reply alert',
    text: "Yes I'm still interested, could you send me the details for the next intake please?",
    message_id: messageId,
  },
})

const svixId = `msg_test_${Date.now()}`
const svixTimestamp = Math.floor(Date.now() / 1000).toString()
// Svix signs `{id}.{timestamp}.{payload}` with the base64 secret after the
// whsec_ prefix, and sends the signature base64-encoded, prefixed "v1,".
const secret = process.env.RESEND_WEBHOOK_SECRET.replace(/^whsec_/, '')
const signature = crypto
  .createHmac('sha256', Buffer.from(secret, 'base64'))
  .update(`${svixId}.${svixTimestamp}.${payload}`)
  .digest('base64')

const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resend-inbound`
console.log(`\nposting a signed test reply to ${url} …`)

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'svix-id': svixId,
    'svix-timestamp': svixTimestamp,
    'svix-signature': `v1,${signature}`,
  },
  body: payload,
})

const text = await res.text()
console.log(`response ${res.status}: ${text}`)

if (!res.ok) {
  console.error('\nThe function rejected it — the alert will not have been sent.')
  process.exit(1)
}

let replyId = null
try {
  replyId = JSON.parse(text).reply_id
} catch { /* not fatal */ }

console.log(`\nCheck for the alert in: ${owner.email}`)
console.log('Also visible in the Resend dashboard (Emails) with its delivery status,')
console.log('and in the Supabase edge function logs as "Reply alert sent to …".')

if (CLEANUP && replyId) {
  const { error } = await sb.from('email_replies').delete().eq('id', replyId)
  console.log(error ? `cleanup failed: ${error.message}` : `\ncleaned up test reply ${replyId}`)
} else if (replyId) {
  console.log(`\nTest reply ${replyId} is in the CRM. Re-run with --cleanup to remove it.`)
}
