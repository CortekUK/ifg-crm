// One-off cleanup: remove the QA tester's leads from the live CRM.
//
// SCOPE IS DELIBERATELY NARROW. The CRM holds 36 REAL players called Hamza,
// imported from CSV since 2023 (Hamza Ali, Hamza Mansaray, Hamza Nabulsi…).
// Matching on '%hamza%' would delete every one of them. The only safe key is
// the tester's own plus-tagged address, which no real contact uses.
//
// Everything is exported to JSON before deletion, because this cannot be
// undone and "it turned out one of those was real" has no other remedy.
//
//   node scripts/delete-qa-hamza-rows.mjs           (dry run — shows, deletes nothing)
//   node scripts/delete-qa-hamza-rows.mjs --execute (performs the deletion)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const PATTERN = 'hamza.shafique12123+%'
const EXECUTE = process.argv.includes('--execute')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const backupDir = path.join(os.homedir(), `ifg-deleted-hamza-qa-${new Date().toISOString().slice(0, 10)}`)

// ── identify ──────────────────────────────────────────────────────────────
const { data: contacts } = await supabase
  .from('contacts').select('*').ilike('email', PATTERN)
const contactIds = (contacts ?? []).map((c) => c.id)

const { data: profiles } = await supabase
  .from('profiles').select('id, email, role').ilike('email', PATTERN)

console.log(`\nMatched ${contacts?.length ?? 0} contacts and ${profiles?.length ?? 0} portal accounts on "${PATTERN}"`)
for (const c of contacts ?? []) console.log(`  contact  ${c.first_name} ${c.last_name} <${c.email}>`)
for (const p of profiles ?? []) console.log(`  account  ${p.email} (${p.role})`)

// Safety rail: if this ever matches an unexpected number of rows, something
// is wrong with the pattern and we stop rather than delete at scale.
if ((contacts?.length ?? 0) > 20) {
  console.error('\nABORT: matched more contacts than expected. Check the pattern.')
  process.exit(1)
}

// Guard against a real person slipping in: every match must be a "QA" record.
const notQa = (contacts ?? []).filter(
  (c) => !/qa/i.test(`${c.first_name ?? ''} ${c.last_name ?? ''}`),
)
if (notQa.length) {
  console.error('\nABORT: these matched but are not named QA — check before deleting:')
  for (const c of notQa) console.error(`  ${c.first_name} ${c.last_name} <${c.email}>`)
  process.exit(1)
}

// ── collect dependants ────────────────────────────────────────────────────
const inList = contactIds.length ? contactIds : ['00000000-0000-0000-0000-000000000000']
const dealRows = (await supabase.from('deals').select('*').in('contact_id', inList)).data ?? []
const dealIds = dealRows.map((d) => d.id)

const grab = async (table, build) => (await build(supabase.from(table).select('*'))).data ?? []

const sets = {
  contacts: contacts ?? [],
  profiles: profiles ?? [],
  deals: dealRows,
  invoices: await grab('invoices', (q) => q.in('contact_id', inList)),
  payments: await grab('payments', (q) => q.in('contact_id', inList)),
  email_replies: await grab('email_replies', (q) => q.or(`contact_id.in.(${inList.join(',')}),from_email.ilike.${PATTERN}`)),
  email_sends: await grab('email_sends', (q) => q.or(`recipient_contact_id.in.(${inList.join(',')}),recipient_email.ilike.${PATTERN}`)),
  automation_enrollments: dealIds.length ? await grab('automation_enrollments', (q) => q.in('deal_id', dealIds)) : [],
  contact_lists: await grab('contact_lists', (q) => q.in('contact_id', inList)),
  contact_tags: await grab('contact_tags', (q) => q.in('contact_id', inList)),
  form_submissions: await grab('form_submissions', (q) => q.in('contact_id', inList)),
  portal_users: await grab('portal_users', (q) => q.in('contact_id', inList)),
}

console.log('\nRows that will be removed:')
for (const [k, v] of Object.entries(sets)) if (v.length) console.log(`  ${k.padEnd(24)} ${v.length}`)

if (!EXECUTE) {
  console.log('\nDRY RUN — nothing deleted. Re-run with --execute to perform it.')
  process.exit(0)
}

// ── backup ────────────────────────────────────────────────────────────────
fs.mkdirSync(backupDir, { recursive: true })
for (const [name, rows] of Object.entries(sets)) {
  if (rows.length) fs.writeFileSync(path.join(backupDir, `${name}.json`), JSON.stringify(rows, null, 2))
}
console.log(`\nBacked up to ${backupDir}`)

// ── delete, in foreign-key order ──────────────────────────────────────────
// email_replies / email_sends are ON DELETE SET NULL against contacts, so
// deleting the contact would ORPHAN them rather than remove them. They have
// to go explicitly, and first.
const step = async (label, fn) => {
  const { error, count } = await fn()
  if (error) console.error(`  ${label}: FAILED — ${error.message}`)
  else console.log(`  ${label}: removed ${count ?? '?'}`)
}

console.log('\nDeleting:')
await step('email_replies', () =>
  supabase.from('email_replies').delete({ count: 'exact' })
    .or(`contact_id.in.(${inList.join(',')}),from_email.ilike.${PATTERN}`))
await step('email_sends', () =>
  supabase.from('email_sends').delete({ count: 'exact' })
    .or(`recipient_contact_id.in.(${inList.join(',')}),recipient_email.ilike.${PATTERN}`))

// invoices are ON DELETE RESTRICT against contacts, so they must go before the
// contact. payments cascade from invoices; the explicit sweep catches any
// payment attached to the contact but not to an invoice.
await step('invoices (payments cascade)', () =>
  supabase.from('invoices').delete({ count: 'exact' }).in('contact_id', inList))
await step('payments (any remaining)', () =>
  supabase.from('payments').delete({ count: 'exact' }).in('contact_id', inList))

// contacts cascades deals → enrolments, logs, activities, stage history, and
// also contact_lists, contact_tags, form_submissions, portal_users, documents.
await step('contacts (cascades deals + the rest)', () =>
  supabase.from('contacts').delete({ count: 'exact' }).ilike('email', PATTERN))

// Portal logins live in auth.users; profiles cascade from there.
console.log('\nPortal login accounts:')
for (const p of profiles ?? []) {
  const { error } = await supabase.auth.admin.deleteUser(p.id)
  console.log(`  ${p.email}: ${error ? `FAILED — ${error.message}` : 'deleted'}`)
}

// ── verify ────────────────────────────────────────────────────────────────
console.log('\nVerifying nothing is left:')
const left = {
  contacts: (await supabase.from('contacts').select('id', { count: 'exact', head: true }).ilike('email', PATTERN)).count,
  profiles: (await supabase.from('profiles').select('id', { count: 'exact', head: true }).ilike('email', PATTERN)).count,
  email_replies: (await supabase.from('email_replies').select('id', { count: 'exact', head: true }).ilike('from_email', PATTERN)).count,
  email_sends: (await supabase.from('email_sends').select('id', { count: 'exact', head: true }).ilike('recipient_email', PATTERN)).count,
  deals: dealIds.length ? (await supabase.from('deals').select('id', { count: 'exact', head: true }).in('id', dealIds)).count : 0,
  invoices: (await supabase.from('invoices').select('id', { count: 'exact', head: true }).in('contact_id', inList)).count,
}
for (const [k, v] of Object.entries(left)) console.log(`  ${k.padEnd(16)} ${v}`)

// The real players must be untouched.
const { count: realHamzas } = await supabase
  .from('contacts').select('id', { count: 'exact', head: true })
  .ilike('first_name', '%hamza%').not('email', 'ilike', PATTERN)
console.log(`\nReal players named Hamza still present: ${realHamzas} (expected 36)`)

const clean = Object.values(left).every((v) => v === 0)
console.log(clean ? '\nDone — all QA rows removed.' : '\n!! Residue remains, investigate.')
