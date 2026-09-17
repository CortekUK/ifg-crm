// Asserts the import preview describes the import that actually runs.
//
// The dialog shows detectRouting()'s answer; the server derives its own in
// app/api/contacts/bulk-import/route.ts. Two code paths over the same shared
// normalisers, and if they drift the failure mode is the worst kind: a
// confident preview of something that never happens.
//
// This mirrors the server's derivation from the SAME helpers the route
// imports, runs both over fixture rows, and fails if they disagree.
//
//   node scripts/verify-import-detect.mjs
//
// No test framework and no ts-node: the modules are compiled with the tsc
// already in node_modules, then required with a four-line resolver for the
// "@/" alias that tsc leaves in its output.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import path from 'node:path'

const ROOT = process.cwd()
const OUT = mkdtempSync(path.join(tmpdir(), 'ifg-verify-'))

try {
  const tsconfig = path.join(OUT, 'tsconfig.json')
  writeFileSync(
    tsconfig,
    JSON.stringify({
      compilerOptions: {
        outDir: path.join(OUT, 'build'),
        rootDir: ROOT,
        module: 'commonjs',
        target: 'es2022',
        moduleResolution: 'node',
        skipLibCheck: true,
        esModuleInterop: true,
        baseUrl: ROOT,
        paths: { '@/*': ['./*'] },
      },
      files: [
        path.join(ROOT, 'lib/utils/import-detect.ts'),
        path.join(ROOT, 'lib/utils/csv.ts'),
        path.join(ROOT, 'lib/utils/import-normalise.ts'),
        path.join(ROOT, 'lib/forms/lead-routing.ts'),
        path.join(ROOT, 'lib/utils/import-parent-email.ts'),
      ],
    }),
  )

  execFileSync('npx', ['tsc', '-p', tsconfig], { stdio: 'inherit' })

  const BUILD = path.join(OUT, 'build')
  const require_ = createRequire(import.meta.url)
  const Module = require_('module')
  const originalResolve = Module._resolveFilename
  Module._resolveFilename = function (request, ...rest) {
    // tsc emits "@/..." verbatim; map it onto the compiled tree.
    if (request.startsWith('@/')) request = path.join(BUILD, request.slice(2))
    return originalResolve.call(this, request, ...rest)
  }

  const { detectRouting } = require_(path.join(BUILD, 'lib/utils/import-detect.js'))
  const { buildContactFromRow, extractTagsFromRow } = require_(path.join(BUILD, 'lib/utils/csv.js'))
  const {
    normalisePositions,
    normaliseState,
    normaliseCountry,
    countryFromState,
  } = require_(path.join(BUILD, 'lib/utils/import-normalise.js'))
  const { cohortListNames, genderTagName } = require_(path.join(BUILD, 'lib/forms/lead-routing.js'))
  const { applyParentEmailFallback } = require_(path.join(BUILD, 'lib/utils/import-parent-email.js'))

  const MAPPING = {
    0: 'email', 1: 'first_name', 2: 'last_name', 3: 'gender',
    4: 'graduation_year', 5: 'state', 6: 'country', 7: 'position', 8: '__tags__',
  }

  const ROWS = [
    ['a@x.com', 'Ann', 'Lee', 'Female', '2027', 'CA', '', 'CAM', 'Trialist'],
    ['b@x.com', 'Ben', 'Roy', 'Male', '2027', 'Texas', 'USA', 'Goalkeeper', ''],
    ['c@x.com', 'Cal', 'Fox', 'M', '2030', 'ON', '', 'Attacking Midfielder', 'Trialist'],
    ['d@x.com', 'Dee', 'Ray', '', '', 'NG', 'Nigeria', 'Striker', ''],
    ['e@x.com', 'Eve', 'Kim', 'female', '2027', '', 'England', '', ''],
    ['', 'No', 'Email', 'Male', '2027', 'CA', '', 'Winger', ''], // dropped by the server
    ['g@x.com', 'Gus', 'Ash', 'Male', 'not-a-year', 'ZZ', 'Freedonia', 'Sweeper', ''],
  ]

  /** The server's per-row derivation, mirrored from route.ts. */
  function serverSide(rows, mapping, fallback = {}) {
    const cohorts = new Map()
    const tags = new Map()
    const bump = (m, k) => m.set(k, (m.get(k) ?? 0) + 1)

    for (const row of rows) {
      const contact = buildContactFromRow(row, mapping, 'DMY')
      if (!contact.email?.trim()) continue

      if (!contact.country) {
        const implied = countryFromState(normaliseState(contact.state))
        if (implied) contact.country = implied
      }

      const gender = contact.gender ?? fallback.gender ?? null
      const year = contact.graduation_year ?? fallback.graduationYear ?? null

      for (const n of cohortListNames(gender, year)) bump(cohorts, n)

      for (const n of extractTagsFromRow(row, mapping)) bump(tags, `other|${n}`)
      const g = genderTagName(gender)
      if (g) bump(tags, `gender|${g}`)
      if (year) bump(tags, `year|${year}`)
      for (const p of normalisePositions(contact.position)) bump(tags, `position|${p}`)
      const state = normaliseState(contact.state)
      const country = normaliseCountry(contact.country)
      if (state) bump(tags, `location|${state}`)
      if (country) bump(tags, `location|${country}`)
    }
    return { cohorts, tags }
  }

  function flatten(detection) {
    const cohorts = new Map(detection.cohortLists.map((c) => [c.name, c.count]))
    const tags = new Map()
    for (const g of detection.tags) {
      for (const v of g.values) tags.set(`${g.category}|${v.name}`, v.count)
    }
    return { cohorts, tags }
  }

  function compare(label, a, b) {
    const keys = [...new Set([...a.keys(), ...b.keys()])].sort()
    const bad = keys.filter((k) => (a.get(k) ?? 0) !== (b.get(k) ?? 0))
    if (bad.length === 0) {
      console.log(`  ok    ${label} — ${keys.length} distinct values agree`)
      return true
    }
    for (const k of bad) {
      console.error(`  FAIL  ${label}: ${k} preview=${a.get(k) ?? 0} server=${b.get(k) ?? 0}`)
    }
    return false
  }

  let ok = true
  for (const [label, fallback] of [
    ['no list chosen', {}],
    ['list "2026 MENS" chosen', { gender: 'male', graduationYear: 2026 }],
  ]) {
    console.log(`\n${label}:`)
    const preview = flatten(detectRouting(ROWS, MAPPING, 'DMY', fallback))
    const server = serverSide(ROWS, MAPPING, fallback)
    ok = compare('cohort lists', preview.cohorts, server.cohorts) && ok
    ok = compare('tags        ', preview.tags, server.tags) && ok
  }

  // The email-less row must be excluded, not silently inflating every count.
  const d = detectRouting(ROWS, MAPPING, 'DMY', {})
  if (d.totalRows !== ROWS.length - 1 || d.skippedRows !== 1) {
    console.error(`\n  FAIL  row accounting: totalRows=${d.totalRows} skippedRows=${d.skippedRows}`)
    ok = false
  } else {
    console.log(`\n  ok    row accounting — ${d.totalRows} counted, ${d.skippedRows} skipped for no email`)
  }

  // ---- parent email as the contact email ---------------------------------
  //
  // One address, one contact: an address goes to a row only when nobody else
  // has a claim on it, and a clash is named, never resolved silently.
  console.log('\nparent email fallback:')
  const check = (label, cond, detail = '') => {
    if (cond) console.log(`  ok    ${label}`)
    else { console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`); ok = false }
  }

  const PM = { 0: 'email', 1: 'first_name', 2: 'last_name', 3: 'parent_email' }
  const P = [
    ['own@x.com', 'Olly', 'Own', 'p0@x.com'],    // 0 has own email: untouched
    ['', 'Sole', 'Kid', 'solo@x.com'],           // 1 only child: takes parent email
    ['', 'Tom', 'Smith', 'fam@x.com'],           // 2 first sibling: takes it
    ['', 'Sam', 'Smith', 'fam@x.com'],           // 3 second sibling: clash
    ['', 'Tom', 'Smith', 'FAM@x.com '],          // 4 Tom's row repeated: same person, fine
    ['', 'Kid', 'Zero', 'own@x.com'],            // 5 address is row 0's OWN email: clash
    ['', 'Bob', 'Doe', 'crm@x.com'],             // 6 CRM holds it under another name: clash
    ['', 'Liam', 'Ray', 'crm2@x.com'],           // 7 CRM holds it under THIS name: re-run, fine
    ['', 'No', 'Contact', ''],                   // 8 nothing to use
    ['', 'Tom', 'Lee', 'fam2@x.com'],            // 9 CRM has Sam Lee on it: clash
    ['', 'Sam', 'Lee', 'fam2@x.com'],            // 10 Sam Lee himself: fine, even though row 9 came first
  ]
  const owners = new Map([
    ['crm@x.com', { first_name: 'Jane', last_name: 'Doe' }],
    ['crm2@x.com', { first_name: 'Liam', last_name: 'Ray' }],
    ['fam2@x.com', { first_name: 'Sam', last_name: 'Lee' }],
  ])

  const on = applyParentEmailFallback(P, PM, owners, true)
  check('only child takes the parent email', on.fromParent.has(1) && on.rows[1][0] === 'solo@x.com')
  check('first sibling takes it', on.fromParent.has(2) && on.rows[2][0] === 'fam@x.com')
  check('second sibling is named, not merged',
    on.clashes.get(3) === 'Shares a parent email with Tom Smith (row 3)', on.clashes.get(3))
  check('a repeated row for the same player is not a clash', on.fromParent.has(4) && !on.clashes.has(4))
  check("another row's own email is never handed out",
    on.clashes.get(5) === "Parent email is already Olly Own's own email (row 1)", on.clashes.get(5))
  check("a different person's CRM address is never handed out",
    on.clashes.get(6) === 'Parent email already belongs to Jane Doe in the CRM', on.clashes.get(6))
  check('the same player already in the CRM is a re-run, not a clash',
    on.fromParent.has(7) && !on.clashes.has(7))
  check('the CRM owner wins over whichever sibling comes first in the file',
    on.clashes.has(9) && on.fromParent.has(10) && !on.clashes.has(10),
    `9=${on.clashes.get(9)} 10 used=${on.fromParent.has(10)}`)
  check('a row with its own email is left alone', !on.fromParent.has(0) && on.rows[0][0] === 'own@x.com')
  check('a row with nothing to use is left alone', !on.fromParent.has(8) && !on.clashes.has(8))
  check('eligible counts every row that could use a parent email', on.eligible === 9, `eligible=${on.eligible}`)
  check('input rows are not mutated', P[1][0] === '' && P[2][0] === '')

  const off = applyParentEmailFallback(P, PM, owners, false)
  check('unticked: nothing substituted, nothing flagged',
    off.fromParent.size === 0 && off.clashes.size === 0 && off.eligible === 9)

  const unmapped = applyParentEmailFallback(P, { 0: 'email', 1: 'first_name', 2: 'last_name' }, owners, true)
  check('no Parent Email column mapped: feature stays out of the way',
    unmapped.eligible === 0 && unmapped.fromParent.size === 0)

  console.log(ok ? '\nPASS' : '\nFAIL')
  process.exit(ok ? 0 : 1)
} finally {
  rmSync(OUT, { recursive: true, force: true })
}
