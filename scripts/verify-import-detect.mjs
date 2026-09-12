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

  console.log(ok ? '\nPASS' : '\nFAIL')
  process.exit(ok ? 0 : 1)
} finally {
  rmSync(OUT, { recursive: true, force: true })
}
