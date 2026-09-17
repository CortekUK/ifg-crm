import type { SupabaseClient } from '@supabase/supabase-js'
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js'

export interface Column {
  key: string
  label: string
}

export type Row = Record<string, unknown>

/**
 * CSV that survives Excel.
 *
 * A BOM is prepended so Excel reads it as UTF-8 rather than mangling
 * accented names, and any cell starting with =, +, - or @ is prefixed with
 * a quote so a spreadsheet treats it as text instead of a formula.
 */
export function toCSV(rows: Row[], columns: Column[]): string {
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return '""'
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '""'
    if (typeof value === 'boolean') return value ? '"Yes"' : '"No"'

    let text = value instanceof Date ? value.toISOString() : String(value)
    if (/^[=+\-@]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
  }

  const header = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',')
  const body = rows.map((row) => columns.map((c) => escape(row[c.key])).join(','))
  return '﻿' + [header, ...body].join('\r\n')
}

const PAGE = 1000

/**
 * Read every matching row, not the first thousand.
 *
 * PostgREST caps a response at 1000 rows and this project has that cap set
 * server-side, so it cannot be raised per request. The Contacts export used
 * to issue one unpaged `.select()` against 105,285 contacts and hand the
 * user a file containing 1000 of them, labelled as a full export.
 *
 * Pages are fetched in waves rather than one at a time. The limit is round
 * trips, not database work — 106 sequential pages take about a minute,
 * where twelve at a time take eight seconds. Waves start at one page and
 * double, so a small result costs one query rather than twelve.
 *
 * The trade-off of fetching pages concurrently is that they no longer see
 * one instant: a row inserted mid-export shifts later page boundaries. Rows
 * are therefore deduplicated by primary key, which removes any row a shift
 * would otherwise duplicate. A row inserted during the export may land
 * either side of a boundary and be missed — for an export of records that
 * arrive a few times a day, re-running it is the remedy.
 */
export async function fetchAll<T = Row>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  build: () => PostgrestFilterBuilder<any, any, any, any, any>,
  { max = 200_000, concurrency = 12 }: { max?: number; concurrency?: number } = {},
): Promise<T[]> {
  const collected: T[] = []
  const maxPages = Math.ceil(max / PAGE)

  // Waves ramp up 1, 2, 4, 8 … to `concurrency`. Firing a full wave blind
  // meant a 7-row result still ran twelve competing queries — a seven-contact
  // list took 4.5s to export — while a result that needs many pages loses only
  // a few round trips to the ramp.
  let width = 1
  for (let page = 0; page < maxPages; page += width, width = Math.min(width * 2, concurrency)) {
    const wave = []
    for (let i = page; i < Math.min(page + width, maxPages); i++) {
      wave.push(build().range(i * PAGE, i * PAGE + PAGE - 1))
    }

    const results = await Promise.all(wave)
    let reachedEnd = false

    for (const { data, error } of results) {
      if (error) throw new Error(error.message)
      if (!data) {
        reachedEnd = true
        break
      }
      collected.push(...(data as T[]))
      // A short page is the last one. Later pages in this wave are then
      // empty, so there is nothing to lose by stopping here.
      if (data.length < PAGE) {
        reachedEnd = true
        break
      }
    }

    if (reachedEnd) break
  }

  // Deduplicate on the primary key where the rows carry one. Reports that
  // aggregate in SQL return synthetic rows with no id; those pass through.
  const seen = new Set<unknown>()
  const unique: T[] = []
  for (const row of collected) {
    const id = (row as Row)?.id
    if (id === undefined) {
      unique.push(row)
      continue
    }
    if (seen.has(id)) continue
    seen.add(id)
    unique.push(row)
  }

  return unique
}

/** Look up ids → labels in one query, paged. */
export async function labelMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  table: string,
  ids: (string | null | undefined)[],
  labelColumn: string,
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  if (unique.length === 0) return new Map()

  const map = new Map<string, string>()
  // `.in()` with thousands of ids makes a URL no server will accept.
  for (let i = 0; i < unique.length; i += 200) {
    const slice = unique.slice(i, i + 200)
    const { data } = await supabase
      .from(table)
      .select(`id, ${labelColumn}`)
      .in('id', slice)
    for (const row of (data ?? []) as unknown[]) {
      const record = row as Record<string, unknown>
      map.set(String(record.id), String(record[labelColumn] ?? ''))
    }
  }
  return map
}

/** ISO timestamp → "2026-08-29 14:32", or empty. Reads better in a spreadsheet. */
export function dt(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().replace('T', ' ').slice(0, 16)
}

/** ISO timestamp → "2026-08-29". */
export function day(value: string | null | undefined): string {
  if (!value) return ''
  return String(value).slice(0, 10)
}

/** Whole days between two instants, or null. */
export function daysBetween(from: string | null | undefined, to: string | null | undefined) {
  if (!from || !to) return null
  const a = new Date(from).getTime()
  const b = new Date(to).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round(((b - a) / 86_400_000) * 10) / 10
}

export function fullName(
  contact: { first_name?: string | null; last_name?: string | null } | null | undefined,
): string {
  if (!contact) return ''
  return `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim()
}
