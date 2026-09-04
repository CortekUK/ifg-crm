/**
 * The deposit checkout, against the live API, in every terms state.
 *
 * This exists because checking only the happy path is exactly how the terms
 * feature took payments down: consent was requested unconditionally, no
 * programme had published terms, and Stripe rejected every session while the
 * website showed "Application received".
 *
 * Each state is exercised end to end against the deployed endpoint:
 *
 *   no terms published            → checkout, no tick box anywhere
 *   terms published, not agreed   → refused with TERMS_NOT_ACCEPTED
 *   terms published, agreed       → checkout, version recorded
 *
 * Usage: node scripts/verify-deposit-terms.mjs [--url https://ifg-crm.vercel.app]
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)

const argUrl = process.argv.indexOf('--url')
const BASE = argUrl > -1 ? process.argv[argUrl + 1] : 'https://ifg-crm.vercel.app'
const SITE = process.argv.includes('--site')
  ? process.argv[process.argv.indexOf('--site') + 1]
  : 'https://ifg-crm-cvz9.vercel.app'
// Any contact with an active Summer Residency deal will do — the resolver
// only reaches the terms gate once it has found a deal to invoice against.
// Resolved at run time because test contacts get cleaned up.
let EMAIL = process.argv.includes('--email')
  ? process.argv[process.argv.indexOf('--email') + 1]
  : null

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

async function deposit(body) {
  const res = await fetch(`${BASE}/api/public/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.FORM_INGEST_SECRET}` },
    body: JSON.stringify({
      email: EMAIL, programme: 'residency', mode: 'deposit',
      origin: 'https://ifg-crm-cvz9.vercel.app', ...body,
    }),
  })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

if (!EMAIL) {
  const { data: candidates } = await sb
    .from('deals')
    .select('status, contact:contacts(email), pipeline:pipelines(name)')
    .eq('status', 'active')
  const match = (candidates ?? []).find(
    (d) => /residency/i.test(d.pipeline?.name ?? '') && d.contact?.email,
  )
  if (!match) {
    console.error('No contact with an active Summer Residency deal — nothing to test against.')
    process.exit(1)
  }
  EMAIL = match.contact.email
}
console.log(`Testing deposit checkout as ${EMAIL}\n`)

const { data: before } = await sb
  .from('website_terms').select('*').eq('programme', 'residency').single()

try {
  // ── 1. No published terms — the state this shipped in ─────────────────────
  await sb.from('website_terms').update({ published: false }).eq('programme', 'residency')

  // The public terms page must track the published flag both ways. It was
  // prerendered with generateStaticParams, so at build time (nothing
  // published) all three baked as a cached 404 that never recovered once the
  // terms went live — the tick box linked straight to a dead page.
  let page = await fetch(`${SITE}/terms/summer-residency`, { cache: 'no-store' })
  check('unpublished → terms page 404s', page.status === 404, `HTTP ${page.status}`)

  let r = await deposit({})
  check('no terms published → checkout still works',
    r.status === 200 && r.data.status === 'checkout', `HTTP ${r.status} ${r.data.error ?? ''}`)

  // ── 2. Published, not agreed — must be refused ────────────────────────────
  await sb.from('website_terms').update({
    body: '<h2>Test</h2><p>Terms body.</p>', published: true, version: 3,
  }).eq('programme', 'residency')

  page = await fetch(`${SITE}/terms/summer-residency`, { cache: 'no-store' })
  const html = page.ok ? await page.text() : ''
  check('published → terms page renders', page.status === 200, `HTTP ${page.status}`)
  check('published → page shows the terms text', html.includes('Terms body.'))

  const api = await fetch(`${SITE}/api/terms/residency`, { cache: 'no-store' })
    .then((x) => x.json()).catch(() => ({}))
  check('published → dialogue is told to show the tick box',
    api.published === true && api.version === 3, JSON.stringify(api))

  r = await deposit({})
  check('terms published, not agreed → refused',
    r.status === 400 && r.data.code === 'TERMS_NOT_ACCEPTED', `HTTP ${r.status} ${r.data.code ?? ''}`)

  r = await deposit({ termsAccepted: false })
  check('explicit false → refused', r.status === 400, `HTTP ${r.status}`)

  // ── 3. Published and agreed — checkout, with the version recorded ─────────
  r = await deposit({ termsAccepted: true, termsVersion: 3 })
  check('terms published and agreed → checkout',
    r.status === 200 && r.data.status === 'checkout', `HTTP ${r.status} ${r.data.error ?? ''}`)

  if (r.data.status === 'checkout') {
    const { data: inv } = await sb
      .from('invoices').select('stripe_checkout_session_id')
      .not('stripe_checkout_session_id', 'is', null)
      .order('updated_at', { ascending: false }).limit(1).maybeSingle()

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(env.STRIPE_SECRET_KEY)
    const session = await stripe.checkout.sessions.retrieve(inv.stripe_checkout_session_id)

    check('version recorded on the payment',
      session.metadata?.terms_version === '3' && session.metadata?.terms_programme === 'residency',
      JSON.stringify(session.metadata))
    check('not asked to tick the box a second time on Stripe',
      session.consent_collection?.terms_of_service == null,
      `consent_collection=${JSON.stringify(session.consent_collection)}`)
    check('acceptance attributed to the website dialogue',
      session.metadata?.terms_source === 'website')
  }
} finally {
  await sb.from('website_terms').update({
    body: before.body, published: before.published, version: before.version,
  }).eq('programme', 'residency')
  const { data: after } = await sb
    .from('website_terms').select('version, published, body').eq('programme', 'residency').single()
  check('database restored',
    after.version === before.version && after.published === before.published && after.body === before.body)
}

console.log(failures === 0 ? '\nDeposit checkout verified in every terms state.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
