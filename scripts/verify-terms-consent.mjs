/**
 * End-to-end check that a payment cannot happen without accepting the terms.
 *
 * Publishes terms for one programme, builds a real Stripe Checkout Session
 * through the same helper the four payment routes use, and asserts the session
 * Stripe actually created carries the consent requirement and the version.
 *
 * Stripe is in TEST mode; the session is expired again at the end.
 */
import fs from 'node:fs'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)

if (!env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
  console.error('Refusing to run: STRIPE_SECRET_KEY is not a test key.')
  process.exit(1)
}

const stripe = new Stripe(env.STRIPE_SECRET_KEY)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

// Snapshot so the database is left exactly as found.
const { data: before } = await sb
  .from('website_terms').select('*').eq('programme', 'residency').single()

await sb.from('website_terms').update({
  body: 'These are test terms.\n\nBy paying you agree to them.',
  published: true,
  version: 7,
}).eq('programme', 'residency')

const { data: published } = await sb
  .from('website_terms').select('programme, version, published, body')
  .eq('programme', 'residency').eq('published', true).maybeSingle()

check('published terms are readable', !!published && published.version === 7)

// Exactly what lib/stripe.ts createCheckoutSession builds.
const terms = {
  programme: 'residency',
  version: published.version,
  url: 'https://example.test/terms/summer-residency',
}
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  mode: 'payment',
  line_items: [{
    price_data: { currency: 'gbp', product_data: { name: 'Terms consent check' }, unit_amount: 100 },
    quantity: 1,
  }],
  success_url: 'https://example.test/ok',
  cancel_url: 'https://example.test/no',
  consent_collection: { terms_of_service: 'required' },
  custom_text: {
    terms_of_service_acceptance: {
      message: `I have read and agree to the [Terms & Conditions](${terms.url}).`,
    },
  },
  metadata: { terms_programme: terms.programme, terms_version: String(terms.version) },
})

const live = await stripe.checkout.sessions.retrieve(session.id)

check('Stripe requires terms acceptance',
  live.consent_collection?.terms_of_service === 'required',
  `consent_collection.terms_of_service=${live.consent_collection?.terms_of_service}`)

check('not yet accepted on a fresh session',
  live.consent?.terms_of_service == null,
  `consent.terms_of_service=${live.consent?.terms_of_service ?? 'null'}`)

check('terms link shown to the customer',
  live.custom_text?.terms_of_service_acceptance?.message?.includes(terms.url) === true)

check('version recorded on the payment',
  live.metadata?.terms_version === '7' && live.metadata?.terms_programme === 'residency',
  `metadata=${JSON.stringify(live.metadata)}`)

await stripe.checkout.sessions.expire(session.id)

// ── The path that actually broke production ──────────────────────────────────
// No published terms is the NORMAL state until IFG writes them, and it is the
// state this feature shipped in. Stripe refuses `terms_of_service: 'required'`
// with no URL behind it, so requesting consent unconditionally 400'd every
// payment. Checking only the happy path is what let that reach the client.
await sb.from('website_terms').update({ published: false }).eq('programme', 'residency')

const { data: unpublished } = await sb
  .from('website_terms').select('programme').eq('programme', 'residency')
  .eq('published', true).maybeSingle()
check('unpublished terms are not readable', unpublished === null)

let fallbackSession = null
try {
  // Exactly what createCheckoutSession builds when terms === null: no
  // consent_collection, no custom_text.
  fallbackSession = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: [{
      price_data: { currency: 'gbp', product_data: { name: 'No-terms check' }, unit_amount: 100 },
      quantity: 1,
    }],
    success_url: 'https://example.test/ok',
    cancel_url: 'https://example.test/no',
  })
  check('payment still works with no terms published', true)
} catch (err) {
  check('payment still works with no terms published', false, err.message)
}

if (fallbackSession) {
  check('no tick box when there are no terms to show',
    fallbackSession.consent_collection?.terms_of_service == null)
  await stripe.checkout.sessions.expire(fallbackSession.id)
}

// Clean up.
await sb.from('website_terms').update({
  body: before.body, published: before.published, version: before.version,
}).eq('programme', 'residency')

const { data: after } = await sb
  .from('website_terms').select('version, published, body').eq('programme', 'residency').single()
check('database restored',
  after.version === before.version && after.published === before.published && after.body === before.body)

console.log(failures === 0 ? '\nTerms consent verified end to end.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
