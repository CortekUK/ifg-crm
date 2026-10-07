/**
 * Prove that unsubscribe links in REAL SENT EMAILS can actually be verified by
 * this environment.
 *
 * scripts/verify-unsubscribe.mjs already checks the two mirrored
 * implementations agree byte-for-byte. They did — and every unsubscribe link
 * in production was still dead, because the failure was never in the code.
 *
 * The token is an HMAC keyed on UNSUBSCRIBE_SECRET, falling back to
 * SUPABASE_SERVICE_ROLE_KEY. The link is SIGNED by the Supabase edge function
 * and VERIFIED by the Next.js app — two separately-configured environments. If
 * their keys differ by one byte, every link is rejected, the reader sees
 * "This link isn't valid", and nothing anywhere logs why.
 *
 * That is what happened: the project moved to Supabase's new API key format,
 * the function runtime began injecting a different SUPABASE_SERVICE_ROLE_KEY
 * than the one in the web app's environment, and the implicit shared key
 * silently stopped being shared.
 *
 * This script closes that gap by testing the thing that actually matters:
 * take a token out of an email we really sent, and check we can verify it.
 *
 * Usage: node scripts/verify-unsubscribe-live.mjs
 * Exits non-zero on mismatch, so it can gate a deploy.
 */
import fs from 'node:fs'
import { createHmac, createHash } from 'node:crypto'

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const PURPOSE = 'ifg-unsubscribe-v1'
const b64url = (b) =>
  Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function tokenFor(secret, contactId) {
  const derived = createHmac('sha256', secret).update(PURPOSE).digest()
  return b64url(createHmac('sha256', derived).update(contactId).digest())
}

const secret = process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!secret) {
  console.error('FAIL: neither UNSUBSCRIBE_SECRET nor SUPABASE_SERVICE_ROLE_KEY is set.')
  process.exit(1)
}

const usingExplicit = Boolean(process.env.UNSUBSCRIBE_SECRET)
console.log(`Signing key: ${usingExplicit ? 'UNSUBSCRIBE_SECRET' : 'SUPABASE_SERVICE_ROLE_KEY (implicit)'}`)
console.log(`Key sha256 : ${createHash('sha256').update(secret).digest('hex')}`)
if (!usingExplicit) {
  console.log(
    '\n⚠️  Falling back to the service-role key. That key is injected independently\n' +
      '   into the edge-function runtime and can differ from this one — which is\n' +
      '   precisely how every link broke before. Set UNSUBSCRIBE_SECRET on BOTH sides.',
  )
}

const ref = process.env.SUPABASE_PROJECT_ID
const mgmt = process.env.SUPABASE_ACCESS_TOKEN
if (!ref || !mgmt) {
  console.error('\nFAIL: SUPABASE_PROJECT_ID / SUPABASE_ACCESS_TOKEN needed to read sent emails.')
  process.exit(1)
}

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${mgmt}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `select id, recipient_email, sent_at,
                   substring(body_html from '/unsubscribe\\?c=[^"'' <]+') as link
            from email_sends
            where body_html like '%/unsubscribe?c=%'
            order by sent_at desc limit 10;`,
  }),
})
const rows = JSON.parse(await res.text())

if (!Array.isArray(rows) || rows.length === 0) {
  console.log('\nNo sent emails carrying an unsubscribe link yet — nothing to check.')
  process.exit(0)
}

let checked = 0
let bad = 0
for (const r of rows) {
  if (!r.link) continue
  const params = new URLSearchParams(r.link.split('?')[1])
  const c = params.get('c')
  const t = params.get('t')
  if (!c || !t) continue
  checked++
  if (tokenFor(secret, c) !== t) {
    bad++
    console.log(`\n❌ ${r.sent_at}  ${r.recipient_email}`)
    console.log(`   contact ${c}`)
    console.log(`   in email : ${t}`)
    console.log(`   expected : ${tokenFor(secret, c)}`)
  }
}

console.log(`\nChecked ${checked} sent email(s): ${checked - bad} verifiable, ${bad} rejected.`)

if (bad > 0) {
  console.error(
    '\nFAIL: links in sent email cannot be verified by this environment.\n' +
      'The sender and this app hold different signing keys. Fix:\n' +
      '  1. npx supabase secrets set UNSUBSCRIBE_SECRET=<value> --project-ref <ref>\n' +
      '  2. set the SAME value in Vercel, and redeploy\n' +
      'Links sent before the change stay dead — they were signed with the old key.',
  )
  process.exit(1)
}
console.log('PASS: every sampled link verifies.')
