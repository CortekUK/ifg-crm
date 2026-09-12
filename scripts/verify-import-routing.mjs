// End-to-end check of the multi-list / auto-routing CSV import.
//
// Drives the real /api/contacts/bulk-import route against the real database
// with a signed-in super_admin session, then reads back what it actually
// wrote. The pure preview logic is covered by verify-import-detect.mjs; this
// covers the part that touches Postgres: several chosen lists at once, the
// cohort lists derived per contact, the tag categories the operator left on,
// the de-duplication when a chosen list and a derived cohort collide, and —
// the question that decides whether an import is safe to run twice — that
// importing into a list that already has members ADDS to it rather than
// replacing it, and that a repeat import changes nothing.
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
// Cohort years far enough out that the lists cannot already exist.
const NEW_COHORT = '2031 MENS'
const CREATED_LISTS = ['2031 MENS', '2032 MENS', '2032 WOMENS', '2033 WOMENS']

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

async function memberCount(listId) {
  const { count } = await admin
    .from('contact_lists')
    .select('contact_id', { count: 'exact', head: true })
    .eq('list_id', listId)
  return count ?? 0
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
  const removedLists = []
  for (const name of CREATED_LISTS) {
    const id = await listIdByName(name)
    if (!id) continue
    await admin.from('contact_lists').delete().eq('list_id', id)
    await admin.from('lists').delete().eq('id', id)
    removedLists.push(name)
  }
  const { data: left } = await admin.from('contacts').select('email').like('email', `%${SUFFIX}`)
  return { contacts: ids.length, lists: removedLists, leftover: left ?? [] }
}

try {
  // Never run against a database that already holds these markers — a previous
  // run may have died mid-way and the counts below would be meaningless.
  const { data: pre } = await admin.from('contacts').select('email').like('email', `%${SUFFIX}`)
  if (pre?.length) {
    console.error(`Leftover verification contacts found (${pre.length}). Clean them first.`)
    process.exit(1)
  }
  for (const name of CREATED_LISTS) {
    if (await listIdByName(name)) {
      console.error(`"${name}" already exists — pick different cohort years.`)
      process.exit(1)
    }
  }

  const cookie = await sessionCookie('superadmin@theinternationalfootballgroup.com')
  console.log('signed in as superadmin\n')

  // "ALL MENS" is chosen for the whole file AND derived per row — the exact
  // collision that used to break the membership upsert.
  const allMensId = await listIdByName('ALL MENS')
  const uniId = await listIdByName('UNIVERSITY 2027')
  if (!allMensId || !uniId) throw new Error('expected lists ALL MENS / UNIVERSITY 2027 to exist')

  // "UNIVERSITY 2027" already has members. They must all still be there
  // afterwards — an import adds to a list, it never replaces its contents.
  const uniBefore = await memberCount(uniId)
  const allMensBefore = await memberCount(allMensId)
  console.log(`before: UNIVERSITY 2027 = ${uniBefore} members, ALL MENS = ${allMensBefore}\n`)

  const headers = ['Email', 'First Name', 'Last Name', 'Gender', 'Graduation Year', 'State', 'Position']
  const mapping = { 0: 'email', 1: 'first_name', 2: 'last_name', 3: 'gender', 4: 'graduation_year', 5: 'state', 6: 'position' }
  const rows = [
    [EMAILS[0], 'Alpha', 'Verify', 'Male', '2031', 'CA', 'Goalkeeper'],
    [EMAILS[1], 'Bravo', 'Verify', 'Male', '2031', 'TX', 'CAM'],
    [EMAILS[2], 'Charlie', 'Verify', 'Female', '2031', '', 'Striker'],
  ]

  const runImport = () =>
    fetch(`${BASE}/api/contacts/bulk-import`, {
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

  const res = await runImport()
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

  // ---- importing into a list that already has members ----
  const uniAfter = await memberCount(uniId)
  const allMensAfter = await memberCount(allMensId)
  check(
    'existing members of UNIVERSITY 2027 survive; the 3 new ones are added',
    uniAfter === uniBefore + 3,
    `${uniBefore} -> ${uniAfter}, expected ${uniBefore + 3}`,
  )
  check(
    'existing members of ALL MENS survive',
    allMensAfter === allMensBefore + 3,
    `${allMensBefore} -> ${allMensAfter}, expected ${allMensBefore + 3}`,
  )

  // ---- running the same import twice ----
  const res2 = await runImport()
  const body2 = await res2.json().catch(() => ({}))
  check('second run succeeds', res2.ok, `${res2.status} ${JSON.stringify(body2).slice(0, 200)}`)
  check(
    'second run creates nothing new, updates the same 3',
    body2.created === 0 && body2.updated === 3,
    `created=${body2.created} updated=${body2.updated}`,
  )
  check(
    'membership counts unchanged after re-import',
    (await memberCount(uniId)) === uniAfter && (await memberCount(allMensId)) === allMensAfter,
  )
  const { data: after2 } = await admin
    .from('contact_lists')
    .select('contact_id')
    .in('contact_id', ids)
  check(
    'no duplicate membership rows',
    (after2 ?? []).length === (memberships ?? []).length,
    `${(memberships ?? []).length} -> ${(after2 ?? []).length}`,
  )

  // ==================================================================
  // Phase 2 — routing is PER CONTACT, not per file.
  //
  // The question this answers: import a mixed file and does each row go
  // only into the lists and tags its OWN data implies, or does every row
  // get the union of everything in the file? No whole-file lists are
  // chosen here, so anything a contact lands in came from their own row.
  // ==================================================================
  console.log('\nphase 2 — per-contact routing, no whole-file lists chosen:')

  const MIX = [
    // email suffix, first, gender, year, state, position
    ['mix-a', 'Mixa', 'Male', '2032', 'CA', 'Goalkeeper'],
    ['mix-b', 'Mixb', 'Male', '2032', 'TX', 'Striker'],
    ['mix-c', 'Mixc', 'Female', '2032', 'NY', 'Striker'],
    ['mix-d', 'Mixd', 'Female', '2033', 'FL', 'Centre Back'],
    ['mix-e', 'Mixe', '', '', 'ON', 'Winger'], // no gender, no year
  ]
  const mixRows = MIX.map(([slug, first, gender, year, state, position]) => [
    `${slug}${SUFFIX}`, first, 'Verify', gender, year, state, position,
  ])

  const res3 = await fetch(`${BASE}/api/contacts/bulk-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({
      rows: mixRows, mapping, headers,
      listIds: [], // nothing chosen for the whole file
      duplicateStrategy: 'update',
      routing: {
        cohortLists: {
          'ALL MENS': 'ALL MENS', 'ALL WOMENS': 'ALL WOMENS',
          '2032 MENS': '2032 MENS', '2032 WOMENS': '2032 WOMENS',
          '2033 WOMENS': '2033 WOMENS',
        },
        tagCategories: ['gender', 'year', 'position', 'location'],
      },
      dateOrder: 'DMY', rowOffset: 0,
    }),
  })
  const body3 = await res3.json().catch(() => ({}))
  check('mixed file imports', res3.ok && body3.created === 5, `${res3.status} created=${body3.created}`)

  const { data: mixMade } = await admin
    .from('contacts').select('id, email').like('email', `%mix-%${SUFFIX}`)
  const mixId = new Map((mixMade ?? []).map((c) => [c.email, c.id]))
  const mixIds = [...mixId.values()]

  const { data: mixLists } = await admin
    .from('contact_lists').select('contact_id, lists(name)').in('contact_id', mixIds)
  const { data: mixTags } = await admin
    .from('contact_tags').select('contact_id, tags(name)').in('contact_id', mixIds)

  const L = (slug) => (mixLists ?? [])
    .filter((m) => m.contact_id === mixId.get(`${slug}${SUFFIX}`))
    .map((m) => m.lists.name).sort()
  const T = (slug) => (mixTags ?? [])
    .filter((m) => m.contact_id === mixId.get(`${slug}${SUFFIX}`))
    .map((m) => m.tags.name).sort()

  for (const [slug, expected] of [
    ['mix-a', ['2032 MENS', 'ALL CONTACTS EVERYONE', 'ALL MENS']],
    ['mix-c', ['2032 WOMENS', 'ALL CONTACTS EVERYONE', 'ALL WOMENS']],
    ['mix-d', ['2033 WOMENS', 'ALL CONTACTS EVERYONE', 'ALL WOMENS']],
    ['mix-e', ['ALL CONTACTS EVERYONE']], // no gender/year -> no cohort at all
  ]) {
    check(`${slug} lists are only its own`, JSON.stringify(L(slug)) === JSON.stringify(expected), JSON.stringify(L(slug)))
  }

  check('no man is in ALL WOMENS', !L('mix-a').includes('ALL WOMENS') && !L('mix-b').includes('ALL WOMENS'))
  check('no woman is in ALL MENS', !L('mix-c').includes('ALL MENS') && !L('mix-d').includes('ALL MENS'))
  check('2033 woman is not in 2032 WOMENS', !L('mix-d').includes('2032 WOMENS'), JSON.stringify(L('mix-d')))

  check('California tag only on the California row',
    T('mix-a').includes('CA') && !T('mix-b').includes('CA') && !T('mix-c').includes('CA'),
    `a=${JSON.stringify(T('mix-a'))} b=${JSON.stringify(T('mix-b'))}`)
  check('Goalkeeper tag only on the goalkeeper',
    T('mix-a').includes('Goalkeeper') && !T('mix-b').includes('Goalkeeper') && !T('mix-c').includes('Goalkeeper'),
    `b=${JSON.stringify(T('mix-b'))}`)
  // Positions are normalised, so the tag is the canonical name: "Striker"
  // folds to "Forward", "Winger" to "Outside Midfielder". That is the point —
  // one tag per position rather than one per spelling.
  check('the striker is tagged Forward, not Goalkeeper',
    T('mix-b').includes('Forward') && !T('mix-b').includes('Goalkeeper'),
    JSON.stringify(T('mix-b')))
  check('gender tags do not cross over',
    T('mix-a').includes('Mens') && !T('mix-a').includes('Womens') &&
    T('mix-c').includes('Womens') && !T('mix-c').includes('Mens'))
  check('year tags do not cross over',
    T('mix-a').includes('2032') && !T('mix-a').includes('2033') &&
    T('mix-d').includes('2033') && !T('mix-d').includes('2032'))
  check('the row with no gender or year gets neither tag',
    !T('mix-e').includes('Mens') && !T('mix-e').includes('Womens') &&
    !T('mix-e').some((t) => /^20\d\d$/.test(t)),
    JSON.stringify(T('mix-e')))
  check('but it still gets its own location and position tags',
    T('mix-e').includes('ON') && T('mix-e').includes('Outside Midfielder') && T('mix-e').includes('Canada'),
    JSON.stringify(T('mix-e')))
} finally {
  if (KEEP) {
    console.log('\n--keep: leaving the verification rows in place')
  } else {
    const c = await cleanup()
    console.log(`\ncleanup: removed ${c.contacts} contacts${c.lists.length ? ` and the lists ${c.lists.map((n) => `"${n}"`).join(', ')}` : ''}`)
    if (c.leftover.length) console.error(`LEFTOVER, delete by hand: ${c.leftover.map((r) => r.email).join(', ')}`)
  }
  console.log(failed === 0 ? `\nPASS (${passed} checks)` : `\nFAIL (${failed} of ${passed + failed})`)
  process.exit(failed === 0 ? 0 : 1)
}
