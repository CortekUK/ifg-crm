// End-to-end check of the brochure gate + view tracking.
//
// Drives the real public endpoints (the same ones the website calls), then
// verifies what landed in the database and removes everything it created.
//
//   node scripts/test-brochure-capture.mjs                      # against localhost:3016
//   node scripts/test-brochure-capture.mjs --url https://...    # against a deployment
//   node scripts/test-brochure-capture.mjs --keep               # skip cleanup, inspect in the UI
//
// Safe by design: it only ever touches a contact at @brochure-test.invalid
// (a reserved TLD that can never receive mail) and deletes it at the end.
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const argUrl = process.argv.indexOf('--url')
const BASE = (argUrl > -1 ? process.argv[argUrl + 1] : 'http://127.0.0.1:3016').replace(/\/$/, '')
const KEEP = process.argv.includes('--keep')
const SECRET = process.env.FORM_INGEST_SECRET
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

if (!SECRET) { console.error('FORM_INGEST_SECRET missing from .env'); process.exit(1) }

const stamp = Date.now()
const EMAIL = `brochure.test.${stamp}@brochure-test.invalid`
const results = []
const check = (label, pass, detail = '') => {
  results.push({ label, pass, detail })
  console.log(`  ${pass ? '✓' : '✗'} ${label}${detail ? `  — ${detail}` : ''}`)
}

const post = (path, body) =>
  fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET}` },
    body: JSON.stringify(body),
  })

// Pick the brochure with fewest existing leads so the test is easy to spot.
const { data: brochures } = await sb
  .from('website_brochures')
  .select('id, slug, title, views_count')
  .eq('published', true)
if (!brochures?.length) { console.error('No published brochures to test against.'); process.exit(1) }
const brochure = brochures[0]

console.log(`\nBrochure : ${brochure.title} (${brochure.slug})`)
console.log(`Endpoint : ${BASE}`)
console.log(`Test as  : ${EMAIL}\n`)

const viewsBefore = brochure.views_count

// ── 1. The gate submission ──────────────────────────────────────────────────
console.log('1. Gate submission (what the visitor fills in)')
const enquiry = await post('/api/public/enquiry', {
  email: EMAIL,
  name: 'Brochure Test',
  phone: '+44 7700 900000',
  source: 'brochure',
  brochure_slug: brochure.slug,
  interest: brochure.title,
})
check('endpoint accepted the submission', enquiry.ok, `HTTP ${enquiry.status}`)

const { data: contact } = await sb.from('contacts').select('id, first_name, last_name').eq('email', EMAIL).maybeSingle()
check('contact created', !!contact, contact ? `${contact.first_name} ${contact.last_name}` : 'not found')

if (contact) {
  const { data: bl } = await sb.from('brochure_leads').select('brochure_id').eq('contact_id', contact.id)
  check('recorded as a lead on this brochure', bl?.some((r) => r.brochure_id === brochure.id))

  const { data: cl } = await sb.from('contact_lists').select('list_id, list:lists(name)').eq('contact_id', contact.id)
  check('added to at least one list', (cl?.length ?? 0) > 0,
    cl?.map((r) => r.list?.name).filter(Boolean).join(', '))

  const { data: attached } = await sb.from('brochure_lists').select('list_id, list:lists(name)').eq('brochure_id', brochure.id)
  check('brochure now has an attached list', (attached?.length ?? 0) > 0,
    attached?.map((r) => r.list?.name).filter(Boolean).join(', ') || 'brochure_lists is empty')

  const listIds = new Set((cl ?? []).map((r) => r.list_id))
  check('the attached list is one they were added to',
    (attached ?? []).some((r) => listIds.has(r.list_id)))

  const { data: tags } = await sb.from('contact_tags').select('tag:tags(name)').eq('contact_id', contact.id)
  check('tagged with the brochure', (tags ?? []).some((t) => t.tag?.name === brochure.title),
    (tags ?? []).map((t) => t.tag?.name).join(', '))

  const { data: subs } = await sb.from('form_submissions').select('id').eq('contact_id', contact.id)
  check('logged under Form Submissions', (subs?.length ?? 0) > 0)
}

// ── 2. A view by that same known person ─────────────────────────────────────
console.log('\n2. Return visit (gate skipped, email known)')
const viewKnown = await post('/api/public/brochure/view', { slug: brochure.slug, email: EMAIL, referrer: 'test-harness' })
check('endpoint accepted the view', viewKnown.ok, `HTTP ${viewKnown.status}`)

const { data: attributed } = await sb
  .from('brochure_views')
  .select('contact_id, email')
  .eq('brochure_id', brochure.id)
  .eq('email', EMAIL)
check('view attributed to the contact', attributed?.some((v) => v.contact_id === contact?.id),
  `${attributed?.length ?? 0} view row(s) for this email`)

// ── 3. An anonymous view ────────────────────────────────────────────────────
console.log('\n3. Anonymous visit (nobody we know)')
const viewAnon = await post('/api/public/brochure/view', { slug: brochure.slug, referrer: 'test-harness' })
check('endpoint accepted the view', viewAnon.ok, `HTTP ${viewAnon.status}`)

const { data: fresh } = await sb.from('website_brochures').select('views_count').eq('id', brochure.id).single()
check('view counter moved by exactly 2', fresh.views_count === viewsBefore + 2,
  `${viewsBefore} → ${fresh.views_count}`)

// ── Report ──────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.pass)
console.log(`\n${'─'.repeat(60)}`)
console.log(failed.length === 0
  ? `ALL ${results.length} CHECKS PASSED`
  : `${failed.length} of ${results.length} CHECKS FAILED:\n${failed.map((f) => `  · ${f.label}`).join('\n')}`)

// ── Cleanup ─────────────────────────────────────────────────────────────────
if (KEEP) {
  console.log(`\n--keep: left "${EMAIL}" in place. Search Contacts for it, then delete it yourself.`)
} else {
  await sb.from('brochure_views').delete().eq('referrer', 'test-harness')
  if (contact) {
    await sb.from('brochure_leads').delete().eq('contact_id', contact.id)
    await sb.from('contact_lists').delete().eq('contact_id', contact.id)
    await sb.from('contact_tags').delete().eq('contact_id', contact.id)
    await sb.from('form_submissions').delete().eq('contact_id', contact.id)
    await sb.from('notifications').delete().eq('related_contact_id', contact.id)
    await sb.from('contacts').delete().eq('id', contact.id)
  }
  await sb.from('website_brochures').update({ views_count: viewsBefore }).eq('id', brochure.id)
  console.log(`\nCleaned up. Test contact removed, view count restored to ${viewsBefore}.`)
}

process.exit(failed.length === 0 ? 0 : 1)
