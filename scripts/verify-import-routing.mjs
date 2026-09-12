// End-to-end check of the multi-list / auto-routing CSV import.
//
// Drives the real /api/contacts/bulk-import route against the real database
// with a signed-in super_admin session, then reads back what it actually
// wrote. The pure preview logic is covered by verify-import-detect.mjs; this
// covers the part that touches Postgres: several chosen lists at once, the
// cohort lists derived per contact, the tag categories the operator left on,
// and the de-duplication when a chosen list and a derived cohort collide.
//
//   npm run dev                              # in another terminal
//   node scripts/verify-import-routing.mjs   # add --keep to skip cleanup
//
// WRITES TO THE LIVE DATABASE. Everything it creates uses @import-verify.invalid
// addresses and is deleted in a finally block; if cleanup ever fails the script
// prints the exact rows to remove.

import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const BASE = process.env.VERIFY_BASE_URL || 'http://localhost:3000'
const REF = process.env.SUPABASE_PROJECT_ID
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const KEEP = process.argv.includes('--keep')

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } })

// Unmistakably fake, and a shared suffix so cleanup can find every row.
const SUFFIX = '@import-verify.invalid'
const EMAILS = ['alpha', 'bravo', 'charlie'].map((n) => `${n}${SUFFIX}`)
// A cohort year far enough out that the list cannot already exist.
const NEW_COHORT = '2031 MENS'

let passed = 0
let failed = 0
function check(label, ok, detail = '') {
  if (ok) { passed++; console.log(`  ok    ${label}`) }
  else { failed++; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`) }
}

/** Mint a real session cookie in the format @supabase/ssr 0.8 expects. */
async function sessionCookie(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw new Error(`generateLink: ${error.message}`)

  const pub = createClient(URL_, ANON, { auth: { persistSession: false } })
  const { data: verified, error: vErr } = await pub.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: 'email',
  })
  if (vErr) throw new Error(`verifyOtp: ${vErr.message}`)

  const s = verified.session
  const payload = 'base64-' + Buffer.from(JSON.stringify(s)).toString('base64url')
  const name = `sb-${REF}-auth-token`

  // ssr chunks anything over ~3180 chars into `.0`, `.1`, …
  const LIMIT = 3180
  if (payload.length <= LIMIT) return `${name}=${payload}`
  const parts = []
  for (let i = 0; i < payload.length; i += LIMIT) {
    parts.push(`${name}.${parts.length}=${payload.slice(i, i + LIMIT)}`)
  }
  return parts.join('; ')
}

async function listIdByName(name) {
  const { data } = await admin.from('lists').select('id').eq('name', name).maybeSingle()
  return data?.id ?? null
}

async function cleanup() {
  const { data: contacts } = await admin.from('contacts').select('id').like('email', `%${SUFFIX}`)
  const ids = (contacts ?? []).map((c) => c.id)
  if (ids.length) {
    await admin.from('contact_lists').delete().in('contact_id', ids)
    await admin.from('contact_tags').delete().in('contact_id', ids)
    await admin.from('contacts').delete().in('id', ids)
  }
  const created = await listIdByName(NEW_COHORT)
  if (created) {
    await admin.from('contact_lists').delete().eq('list_id', created)
    await admin.from('lists').delete().eq('id', created)
  }
  const { data: left } = await admin.from('contacts').select('email').like('email', `%${SUFFIX}`)
  return { contacts: ids.length, list: created ? NEW_COHORT : null, leftover: left ?? [] }
}

try {
  // Never run against a database that already holds these markers — a previous
  // run may have died mid-way and the counts below would be meaningless.
  const { data: pre } = await admin.from('contacts').select('email').like('email', `%${SUFFIX}`)
  if (pre?.length) {
    console.error(`Leftover verification contacts found (${pre.length}). Clean them first.`)
    process.exit(1)
  }
  if (await listIdByName(NEW_COHORT)) {
    console.error(`"${NEW_COHORT}" already exists — pick a different NEW_COHORT.`)
    process.exit(1)
  }

  const cookie = await sessionCookie('superadmin@theinternationalfootballgroup.com')
  console.log('signed in as superadmin\n')

  // "ALL MENS" is chosen for the whole file AND derived per row — the exact
  // collision that used to break the membership upsert.
  const allMensId = await listIdByName('ALL MENS')
  const uniId = await listIdByName('UNIVERSITY 2027')
  if (!allMensId || !uniId) throw new Error('expected lists ALL MENS / UNIVERSITY 2027 to exist')

  const headers = ['Email', 'First Name', 'Last Name', 'Gender', 'Graduation Year', 'State', 'Position']
  const mapping = { 0: 'email', 1: 'first_name', 2: 'last_name', 3: 'gender', 4: 'graduation_year', 5: 'state', 6: 'position' }
  const rows = [
    [EMAILS[0], 'Alpha', 'Verify', 'Male', '2031', 'CA', 'Goalkeeper'],
    [EMAILS[1], 'Bravo', 'Verify', 'Male', '2031', 'TX', 'CAM'],
    [EMAILS[2], 'Charlie', 'Verify', 'Female', '2031', '', 'Striker'],
  ]

  const res = await fetch(`${BASE}/api/contacts/bulk-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({
      rows, mapping, headers,
      listIds: [allMensId, uniId],
      duplicateStrategy: 'update',
      routing: {
        // "2031 WOMENS" is deliberately absent: Charlie's cohort is switched
        // off, and she must end up in no cohort list at all.
        cohortLists: { 'ALL MENS': 'ALL MENS', '2031 MENS': NEW_COHORT },
        tagCategories: ['gender', 'year', 'position'], // location switched off
      },
      dateOrder: 'DMY',
      rowOffset: 0,
    }),
  })

  const body = await res.json().catch(() => ({}))
  check('route returns 200', res.ok, `${res.status} ${JSON.stringify(body).slice(0, 200)}`)
  if (!res.ok) throw new Error('route failed; nothing else can be checked')
  check('3 contacts created', body.created === 3, `created=${body.created}`)
  check('no errors reported', (body.errors ?? []).length === 0, JSON.stringify(body.errors))

  const { data: made } = await admin
    .from('contacts')
    .select('id, email, gender, graduation_year')
    .like('email', `%${SUFFIX}`)
  const byEmail = new Map((made ?? []).map((c) => [c.email, c]))
  check('all three rows landed', byEmail.size === 3, `found ${byEmail.size}`)

  // ---- list membership ----
  const ids = [...byEmail.values()].map((c) => c.id)
  const { data: memberships } = await admin
    .from('contact_lists')
    .select('contact_id, lists(name)')
    .in('contact_id', ids)

  const listsFor = (email) => {
    const id = byEmail.get(email)?.id
    return (memberships ?? []).filter((m) => m.contact_id === id).map((m) => m.lists.name).sort()
  }

  const alpha = listsFor(EMAILS[0])
  check(
    'chosen lists + everyone + derived cohort, no duplicates',
    JSON.stringify(alpha) === JSON.stringify(['2031 MENS', 'ALL CONTACTS EVERYONE', 'ALL MENS', 'UNIVERSITY 2027']),
    JSON.stringify(alpha),
  )
  check(
    'ALL MENS appears once despite being both chosen and derived',
    alpha.filter((n) => n === 'ALL MENS').length === 1,
  )

  const charlie = listsFor(EMAILS[2])
  check(
    'switched-off cohort produces no membership',
    !charlie.includes('2031 WOMENS') && !charlie.includes('ALL WOMENS'),
    JSON.stringify(charlie),
  )
  check(
    'she still joins the chosen lists',
    charlie.includes('ALL MENS') && charlie.includes('UNIVERSITY 2027'),
    JSON.stringify(charlie),
  )

  const newList = await listIdByName(NEW_COHORT)
  check(`missing cohort list "${NEW_COHORT}" was created`, !!newList)

  // ---- tags ----
  const { data: tagRows } = await admin
    .from('contact_tags')
    .select('contact_id, tags(name, category)')
    .in('contact_id', ids)
  const tagsFor = (email) => {
    const id = byEmail.get(email)?.id
    return (tagRows ?? []).filter((t) => t.contact_id === id).map((t) => t.tags.name).sort()
  }

  const aTags = tagsFor(EMAILS[0])
  check('gender + year + position tags applied', ['2031', 'Goalkeeper', 'Mens'].every((t) => aTags.includes(t)), JSON.stringify(aTags))
  check('switched-off location category produced no state tag', !aTags.includes('CA') && !aTags.includes('California'), JSON.stringify(aTags))

  const bTags = tagsFor(EMAILS[1])
  check('position normalised (CAM -> Attacking Midfielder)', bTags.includes('Attacking Midfielder'), JSON.stringify(bTags))
} finally {
  if (KEEP) {
    console.log('\n--keep: leaving the verification rows in place')
  } else {
    const c = await cleanup()
    console.log(`\ncleanup: removed ${c.contacts} contacts${c.list ? ` and the list "${c.list}"` : ''}`)
    if (c.leftover.length) console.error(`LEFTOVER, delete by hand: ${c.leftover.map((r) => r.email).join(', ')}`)
  }
  console.log(failed === 0 ? `\nPASS (${passed} checks)` : `\nFAIL (${failed} of ${passed + failed})`)
  process.exit(failed === 0 ? 0 : 1)
}
