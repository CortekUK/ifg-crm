/**
 * Run every report in the catalogue against the live database.
 *
 * The three reports this replaces were broken for months because nothing
 * ever executed them outside a browser click. This executes the real
 * runner for each id, so a missing column or foreign key is a failed
 * script rather than a red toast in front of the client.
 *
 * Usage: node scripts/verify-reports.mjs [--rows]
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { compileRenderer } from './_compile-renderer.mjs'

const env = Object.fromEntries(
  fs
    .readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)

const compiled = compileRenderer(['lib/reports/runners.ts', 'lib/reports/catalogue.ts'])
const { RUNNERS, toCSV } = compiled.load('reports/runners.js')
const { REPORTS } = compiled.load('reports/catalogue.js')

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const end = new Date()
const start = new Date(Date.now() - 365 * 86_400_000)

let failures = 0
const showRows = process.argv.includes('--rows')

// Catalogue and runners must agree, or the grid offers a report the API
// cannot serve.
const missing = REPORTS.filter((r) => !RUNNERS[r.id]).map((r) => r.id)
const orphaned = Object.keys(RUNNERS).filter((id) => !REPORTS.some((r) => r.id === id))
if (missing.length) {
  console.error(`✗ catalogue entries with no runner: ${missing.join(', ')}`)
  failures++
}
if (orphaned.length) {
  console.error(`✗ runners with no catalogue entry: ${orphaned.join(', ')}`)
  failures++
}

for (const report of REPORTS) {
  const runner = RUNNERS[report.id]
  if (!runner) continue

  try {
    const { columns, rows } = await runner({
      supabase,
      start: report.snapshot ? null : start,
      end: report.snapshot ? null : end,
      pipelineId: null,
      recruiterId: null,
    })

    const csv = toCSV(rows, columns)
    const lines = csv.split('\r\n').length - 1

    if (lines !== rows.length) {
      console.error(`✗ ${report.id}: ${rows.length} rows but ${lines} CSV lines`)
      failures++
      continue
    }

    console.log(
      `✓ ${report.id.padEnd(22)} ${String(rows.length).padStart(7)} rows  ${columns.length} cols`,
    )

    if (showRows && rows.length > 0) {
      console.log('   ' + csv.split('\r\n').slice(0, 2).join('\n   '))
    }
  } catch (err) {
    console.error(`✗ ${report.id}: ${err.message}`)
    failures++
  }
}

console.log(failures === 0 ? '\nAll reports ran.' : `\n${failures} report(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
