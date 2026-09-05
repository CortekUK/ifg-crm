/**
 * Does an invoice payment link actually carry the terms tick box?
 *
 * An invoice does not always have a deal — one raised straight against a
 * contact has deal_id null — and the programme was resolved from the deal
 * alone, so those invoices went out with no tick box at all while the CRM
 * reported the feature as working.
 *
 * This walks every unpaid invoice, mints its payment session through the live
 * /pay/<id> route exactly as a recipient clicking "Pay Now" would, and reports
 * whether Stripe was told to collect consent.
 *
 * Usage: node scripts/verify-invoice-terms.mjs [--url https://ifg-crm.vercel.app]
 */
import fs from 'node:fs'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
const argUrl = process.argv.indexOf('--url')
const BASE = argUrl > -1 ? process.argv[argUrl + 1] : 'https://ifg-crm.vercel.app'

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const stripe = new Stripe(env.STRIPE_SECRET_KEY)

const { data: invoices } = await sb
  .from('invoices')
  .select('id, invoice_number, status, deal_id, contact_id, deal:deals(pipeline:pipelines(name))')
  .not('status', 'in', '("paid","cancelled")')
  .order('created_at', { ascending: false })

const { data: publishedTerms } = await sb
  .from('website_terms').select('programme').eq('published', true)
const anyPublished = (publishedTerms ?? []).length > 0

console.log(`${invoices?.length ?? 0} unpaid invoice(s); ${anyPublished ? 'terms ARE published' : 'no terms published'}\n`)

let failures = 0
for (const inv of invoices ?? []) {
  // Clear the cached session so /pay mints a fresh one, which is what an
  // invoice sent today would get.
  await sb.from('invoices').update({ stripe_checkout_session_id: null }).eq('id', inv.id)

  const res = await fetch(`${BASE}/pay/${inv.id}`, { redirect: 'manual' })
  const { data: after } = await sb
    .from('invoices').select('stripe_checkout_session_id').eq('id', inv.id).single()

  if (!after?.stripe_checkout_session_id) {
    console.log(`✗ ${inv.invoice_number}  no session minted (HTTP ${res.status})`)
    failures++
    continue
  }

  const session = await stripe.checkout.sessions.retrieve(after.stripe_checkout_session_id)
  const hasBox = session.consent_collection?.terms_of_service === 'required'
  const pipeline = inv.deal?.pipeline?.name ?? '(no deal)'

  // With terms published, every invoice whose contact belongs to a programme
  // must show the box. Without any published terms, none should.
  const expected = anyPublished
  const ok = hasBox === expected

  console.log(
    `${ok ? '✓' : '✗'} ${inv.invoice_number.padEnd(16)} ${String(pipeline).padEnd(22)} ` +
    `tick box: ${hasBox ? 'yes' : 'no '}  terms v${session.metadata?.terms_version ?? '-'}`,
  )
  if (!ok) failures++
}

console.log(failures === 0 ? '\nEvery invoice payment link is correct.' : `\n${failures} invoice(s) wrong.`)
process.exit(failures === 0 ? 0 : 1)
