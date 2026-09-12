import { useMutation, useQueryClient } from '@tanstack/react-query'
import { detectDateOrder } from '@/lib/utils/csv'

export type DuplicateStrategy = 'skip' | 'update'

export interface ImportOptions {
  rows: string[][]
  mapping: Record<number, string>
  headers: string[]
  skippedColumns?: number[]
  /** Lists every contact in the file joins. */
  listIds: string[]
  tagId: string | null
  /** The operator's routing decisions from the preview step. */
  routing?: ImportRouting
  duplicateStrategy: DuplicateStrategy
  onProgress?: (processed: number, total: number) => void
}

export interface ImportRouting {
  /** Detected cohort list name -> the list name to use. Absent key = switched off. */
  cohortLists: Record<string, string>
  /** Auto-tag categories to apply. */
  tagCategories: string[]
}

export interface ImportResult {
  total: number
  created: number
  updated: number
  skipped: number
  errors: { row: number; message: string }[]
}

/**
 * Rows per request. Each chunk costs a fixed handful of queries server-side
 * (one contact upsert, one list upsert, one tag pass), so larger chunks mean
 * proportionally fewer round trips — bounded by the route's maxDuration and by
 * how granular we want the progress bar to be.
 */
const CHUNK_SIZE = 500

/** Columns whose values are worth sampling to work out the file's date format. */
const DATE_HEADER_RE = /date|dob|birth/i

/**
 * Work out whether this file writes dates day-first or month-first.
 *
 * Detection runs over the whole file rather than the first chunk, because the
 * early rows may all be ambiguous (both components 12 or under) while later
 * ones settle it. Falls back to day-first, the previous behaviour.
 */
export function detectFileDateOrder(headers: string[], rows: string[][]) {
  const dateColumns = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => DATE_HEADER_RE.test(header))
    .map(({ index }) => index)

  if (dateColumns.length === 0) return 'DMY' as const

  function* values() {
    for (const row of rows) {
      for (const index of dateColumns) yield row[index]
    }
  }

  return detectDateOrder(values()) ?? ('DMY' as const)
}

/**
 * Import contacts via the batched server-side endpoint.
 *
 * This used to issue two HTTP requests per row from the browser, which put the
 * 105k-row historic migration at roughly eight hours of an open tab. The work
 * now happens in /api/contacts/bulk-import, which lands a whole chunk in a few
 * queries; the client's only job is to slice the rows and report progress.
 */
export function useImportContacts() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (options: ImportOptions): Promise<ImportResult> => {
      const {
        rows,
        mapping,
        headers,
        skippedColumns = [],
        listIds,
        tagId,
        routing,
        duplicateStrategy,
        onProgress,
      } = options

      const result: ImportResult = {
        total: rows.length,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [],
      }

      const dateOrder = detectFileDateOrder(headers, rows)

      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE)

        const response = await fetch('/api/contacts/bulk-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: chunk,
            mapping,
            headers,
            skippedColumns,
            listIds,
            tagId,
            routing,
            duplicateStrategy,
            dateOrder,
            rowOffset: i,
          }),
        })

        if (!response.ok) {
          // Record the failure against this chunk and keep going — one bad
          // batch shouldn't cost the caller the other hundred thousand rows.
          let message = `Request failed (${response.status})`
          try {
            const body = await response.json()
            if (body?.error) message = body.error
          } catch {
            // Response wasn't JSON — keep the status-code message.
          }
          result.errors.push({ row: i + 1, message })
        } else {
          const data = (await response.json()) as Omit<ImportResult, 'total'>
          result.created += data.created ?? 0
          result.updated += data.updated ?? 0
          result.skipped += data.skipped ?? 0
          if (data.errors?.length) result.errors.push(...data.errors)
        }

        onProgress?.(Math.min(i + CHUNK_SIZE, rows.length), rows.length)
      }

      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact-stats'] })
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      queryClient.invalidateQueries({ queryKey: ['list-stats'] })
      queryClient.invalidateQueries({ queryKey: ['contacts-filter-options'] })
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
  })
}
