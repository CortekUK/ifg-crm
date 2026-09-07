/**
 * Summer Residency 2027 blocks, from Nathan's "Residency Plan 2027" sheet.
 *
 * Replaces the six 2026 options (2/4/6 weeks, £3,500–£8,000) with three dated
 * blocks at the fixed 2027 prices. Six weeks is no longer offered.
 *
 *   Block A  2 weeks  Mon 28 Jun – Mon 12 Jul  £2,995
 *   Block B  2 weeks  Mon 12 Jul – Mon 26 Jul  £2,995
 *   Block C  4 weeks  Mon 28 Jun – Mon 26 Jul  £5,495
 *
 * Everything written here is editable afterwards in the CRM under
 * Website Content → Programme Pricing, including the day-by-day itinerary.
 *
 * Usage: node scripts/seed-residency-2027.mjs [--write]
 *   Without --write it prints what it would change and touches nothing.
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const write = process.argv.includes('--write')

const day = (date, activity) => ({ date, activity })

// Block A, exactly as the sheet lists it.
const BLOCK_A = [
  day('Monday June 28th', 'Arrivals'),
  day('Tuesday June 29th', 'Training'),
  day('Wednesday June 30th', 'Training'),
  day('Thursday July 1st', 'Training'),
  day('Friday July 2nd', 'Training'),
  day('Saturday July 3rd', 'Match-Day'),
  day('Sunday July 4th', 'Trip / Tour'),
  day('Monday July 5th', 'Training'),
  day('Tuesday July 6th', 'Training'),
  day('Wednesday July 7th', 'Match-Day'),
  day('Thursday July 8th', 'University Tour'),
  day('Friday July 9th', 'Training'),
  day('Saturday July 10th', 'Match-Day'),
  day('Sunday July 11th', 'Trip / Tour'),
  day('Monday July 12th', 'Departures'),
]

const BLOCK_B = [
  day('Monday July 12th', 'Arrivals'),
  day('Tuesday July 13th', 'Training'),
  day('Wednesday July 14th', 'Training'),
  day('Thursday July 15th', 'Training'),
  day('Friday July 16th', 'Training'),
  day('Saturday July 17th', 'Match-Day'),
  day('Sunday July 18th', 'Trip / Tour'),
  day('Monday July 19th', 'Training'),
  day('Tuesday July 20th', 'Training'),
  day('Wednesday July 21st', 'Match-Day'),
  day('Thursday July 22nd', 'University Tour'),
  day('Friday July 23rd', 'Training'),
  day('Saturday July 24th', 'Match-Day'),
  day('Sunday July 25th', 'Trip / Tour'),
  day('Monday July 26th', 'Departures'),
]

// Block C is A and B back to back. The sheet has no separate schedule for it,
// so the two are joined on the shared Monday 12 July: a four-week player is
// not departing and re-arriving that day. "Changeover day" is an assumption —
// Nathan can set it to whatever actually happens, in the CMS, in seconds.
const BLOCK_C = [
  ...BLOCK_A.slice(0, -1),
  day('Monday July 12th', 'Changeover day'),
  ...BLOCK_B.slice(1),
]

const BLOCKS = [
  {
    key: 'A', label: 'Block A', duration: '2 weeks',
    subtitle: 'June 28th – July 12th', full_amount: 2995,
    featured: false, sort_order: 0, itinerary: BLOCK_A,
  },
  {
    key: 'B', label: 'Block B', duration: '2 weeks',
    subtitle: 'July 12th – July 26th', full_amount: 2995,
    featured: false, sort_order: 1, itinerary: BLOCK_B,
  },
  {
    key: 'C', label: 'Block C', duration: '4 weeks',
    subtitle: 'June 28th – July 26th', full_amount: 5495,
    featured: true, sort_order: 2, itinerary: BLOCK_C,
  },
]

const { data: existing } = await sb
  .from('website_packages').select('id, key, label, full_amount').eq('programme', 'residency')

console.log('Currently published:')
for (const p of existing ?? []) console.log(`  ${p.key}  ${p.label.padEnd(16)} £${p.full_amount}`)

console.log('\nWill become:')
for (const b of BLOCKS) {
  console.log(`  ${b.key}  ${b.label.padEnd(16)} £${b.full_amount}  ${b.subtitle.padEnd(26)} ${b.itinerary.length} days`)
}

const stale = (existing ?? []).filter((p) => !BLOCKS.some((b) => b.key === p.key))
if (stale.length) console.log(`\nWill remove: ${stale.map((p) => `${p.key} (${p.label})`).join(', ')}`)

if (!write) {
  console.log('\nDry run — nothing changed. Re-run with --write to apply.')
  process.exit(0)
}

for (const b of BLOCKS) {
  const row = {
    programme: 'residency', currency: 'GBP',
    deposit_enabled: true, full_enabled: true, published: true,
    deposit_amount: null, breakdown: [],
    ...b,
  }
  const found = (existing ?? []).find((p) => p.key === b.key)
  const { error } = found
    ? await sb.from('website_packages').update(row).eq('id', found.id)
    : await sb.from('website_packages').insert(row)
  if (error) { console.error(`✗ ${b.key}: ${error.message}`); process.exitCode = 1; continue }
  console.log(`✓ ${b.key} ${b.label} — £${b.full_amount}, ${b.itinerary.length} days`)
}

for (const p of stale) {
  const { error } = await sb.from('website_packages').delete().eq('id', p.id)
  console.log(error ? `✗ remove ${p.key}: ${error.message}` : `✓ removed ${p.key} (${p.label})`)
}
