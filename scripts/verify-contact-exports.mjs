// Every contact export returns every row — checked against the live database.
//
// Runs the real export functions (lib/contacts/export.ts) as a signed-in
// super_admin, so row-level security applies exactly as it does in the
// browser, and compares each result with an exact count taken directly from
// Postgres. Read-only: nothing is written.
//
//   node scripts/verify-contact-exports.mjs
//
// Compiled with the tsc already in node_modules, like verify-import-detect.mjs.

import { execFileSync } from 'node:child_process'
import fs, { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const ROOT = process.cwd()
const OUT = mkdtempSync(path.join(tmpdir(), 'ifg-export-verify-'))
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

let failed = 0
const check = (label, cond, detail = '') => {
  if (cond) console.log(`  ok    ${label}`)
  else { failed++; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`) }
}
const nf = (n) => n.toLocaleString('en-GB')

try {
  const tsconfig = path.join(OUT, 'tsconfig.json')
  writeFileSync(tsconfig, JSON.stringify({
    compilerOptions: {
      outDir: path.join(OUT, 'build'), rootDir: ROOT, module: 'commonjs', target: 'es2022',
      moduleResolution: 'node', skipLibCheck: true, esModuleInterop: true,
      baseUrl: ROOT, paths: { '@/*': ['./*'] },
    },
    files: [path.join(ROOT, 'lib/contacts/export.ts')],
  }))
  execFileSync('npx', ['tsc', '-p', tsconfig], { stdio: 'inherit' })

  const BUILD = path.join(OUT, 'build')
  const require_ = createRequire(import.meta.url)
  const Module = require_('module')
  const resolve = Module._resolveFilename
  Module._resolveFilename = function (request, ...rest) {
    if (request.startsWith('@/')) request = path.join(BUILD, request.slice(2))
    return resolve.call(this, request, ...rest)
  }
  const exp = require_(path.join(BUILD, 'lib/contacts/export.js'))

  // ---- a real browser-equivalent session --------------------------------
  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } })
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink', email: 'superadmin@theinternationalfootballgroup.com',
  })
  if (linkErr) throw linkErr
  const user = createClient(URL_, ANON, { auth: { persistSession: false } })
  const { error: otpErr } = await user.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'email' })
  if (otpErr) throw otpErr

  const exact = async (build) => {
    const { count, error } = await build(admin)
    if (error) throw error
    return count
  }
  const idOf = async (table, name) =>
    (await admin.from(table).select('id').eq('name', name).single()).data.id

  const run = async (label, expected, fn) => {
    const t0 = Date.now()
    const rows = await fn()
    const secs = ((Date.now() - t0) / 1000).toFixed(1)
    const ids = new Set(rows.map((r) => r.id))
    check(`${label}: ${nf(rows.length)} of ${nf(expected)} rows (${secs}s)`, rows.length === expected,
      `missing ${nf(expected - rows.length)}`)
    check(`${label}: no duplicates`, ids.size === rows.length, `${nf(rows.length - ids.size)} repeated`)
    return rows
  }

  const allMens = await idOf('lists', 'ALL MENS')
  const uni = await idOf('lists', 'UNIVERSITY 2027')
  const parentTag = await idOf('tags', 'Parent Email')

  console.log('\nContacts page export:')
  const everyone = await run('no filters', await exact((c) =>
    c.from('contacts').select('id', { count: 'exact', head: true })),
    () => exp.fetchContactsForExport(user, {}))

  await run('graduation year 2027', await exact((c) =>
    c.from('contacts').select('id', { count: 'exact', head: true }).eq('graduation_year', 2027)),
    () => exp.fetchContactsForExport(user, { filters: { graduation_year: 2027 } }))

  await run('tag "Parent Email" filter', await exact((c) =>
    c.from('contact_tags').select('contact_id', { count: 'exact', head: true }).eq('tag_id', parentTag)),
    () => exp.fetchContactsForExport(user, { filters: { tag_id: parentTag } }))

  await run('tag + year together', await exact((c) =>
    c.from('contacts').select('id, contact_tags!inner(tag_id)', { count: 'exact', head: true })
      .eq('contact_tags.tag_id', parentTag).eq('graduation_year', 2027)),
    () => exp.fetchContactsForExport(user, { filters: { tag_id: parentTag, graduation_year: 2027 } }))

  // The on-screen list composes the same helpers into a paged, counted query.
  // It used to resolve a tag into an id list capped at 1000 and pass the ids in
  // the URL, which PostgREST rejects — filtering by this tag failed outright.
  console.log('\nContacts list on screen (useContacts composition):')
  const search = require_(path.join(BUILD, 'lib/contacts/search.js'))
  const onScreen = async (filters) => {
    const tagId = filters.tag_id ?? null
    let q = user.from('contacts').select('*' + search.tagJoin(tagId), { count: 'exact' })
    q = search.applyContactFilters(q, filters)
    q = search.orderContacts(q, undefined, undefined).range(0, 24)
    const { data, error, count } = await q
    if (error) throw error
    return { rows: data.length, count }
  }
  const tagExpected = await exact((c) =>
    c.from('contact_tags').select('contact_id', { count: 'exact', head: true }).eq('tag_id', parentTag))
  const screen = await onScreen({ tag_id: parentTag })
  check(`filter by "Parent Email" shows ${nf(screen.count)} of ${nf(tagExpected)}`, screen.count === tagExpected)
  check('first page is full (25 rows)', screen.rows === 25, `${screen.rows} rows`)

  // Paging on a sort thousands of rows share must not repeat or skip anyone.
  const pageOf = async (from) => {
    let q = user.from('contacts').select('id')
    q = search.orderContacts(q, undefined, undefined).range(from, from + 999)
    const { data, error } = await q
    if (error) throw error
    return data.map((r) => r.id)
  }
  const [p1, p2, p3] = await Promise.all([pageOf(0), pageOf(1000), pageOf(2000)])
  const seen = new Set([...p1, ...p2, ...p3])
  check('adjacent pages never overlap', seen.size === 3000, `${3000 - seen.size} repeated`)

  console.log('\nList export:')
  await run('UNIVERSITY 2027', await exact((c) =>
    c.from('contact_lists').select('contact_id', { count: 'exact', head: true }).eq('list_id', uni)),
    () => exp.fetchListContactsForExport(user, uni))
  await run('ALL MENS', await exact((c) =>
    c.from('contact_lists').select('contact_id', { count: 'exact', head: true }).eq('list_id', allMens)),
    () => exp.fetchListContactsForExport(user, allMens))

  console.log('\nTag export:')
  await run('Parent Email', await exact((c) =>
    c.from('contact_tags').select('contact_id', { count: 'exact', head: true }).eq('tag_id', parentTag)),
    () => exp.fetchTagContactsForExport(user, parentTag))

  console.log('\nCSV:')
  const csv = exp.contactsToCSV(everyone)
  const lines = csv.split('\r\n').length
  check(`file has a header plus ${nf(everyone.length)} rows`, lines === everyone.length + 1, `${nf(lines)} lines`)
  check('opens as UTF-8 in Excel (BOM)', csv.charCodeAt(0) === 0xfeff)
  check('header starts with the expected columns', csv.slice(1).startsWith('"First Name","Last Name","Email"'))

  console.log(failed === 0 ? '\nPASS' : `\nFAIL (${failed})`)
  process.exitCode = failed === 0 ? 0 : 1
} finally {
  rmSync(OUT, { recursive: true, force: true })
}
