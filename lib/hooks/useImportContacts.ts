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
  /**
   * Rows that were folded into an earlier row carrying the same email.
   *
   * Counted separately so `created + updated + skipped + duplicatesInFile +
   * errors` equals the row count of the file. Without it a file containing its
   * own duplicates — which every historic IFG export does — reported fewer
   * rows than it held, and the operator could not tell that from rows being
   * silently dropped (QA-59).
   */
  duplicatesInFile: number
  /**
   * Rows the screen rejected before sending — no usable email, or a sibling
   * clash on a shared parent address.
   *
   * They never reach the server, so the server cannot count them. Without
   * them the four figures were being reconciled against the rows SENT rather
   * than the rows in the file, so a file with invalid rows always looked
   * short (QA-59). Set by the import dialog, which is the only place that
   * knows how many it held back.
   */
  invalid: number
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
        duplicatesInFile: 0,
        invalid: 0,
        errors: [],
      }

      const dateOrder = detectFileDateOrder(headers, rows)

      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE)

        // The request itself can fail, not just come back unhappy.
        //
        // A dropped connection, a DNS blip or a closed laptop lid makes fetch
        // REJECT rather than return a response. That rejection was uncaught, so
        // it escaped the mutation: the import stopped dead on that batch, every
        // later batch went unsent, and the operator saw "Import failed — An
        // unexpected error occurred" with no created/updated/skipped/errors at
        // all. The batches already sent stayed imported, which is precisely the
        // silent partial import this ticket warns about (QA-59).
        //
        // Treated exactly like a rejected response: blame this batch's rows,
        // and carry on with the next one.
        let response: Response
        try {
          response = await fetch('/api/contacts/bulk-import', {
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
        } catch (err) {
          const message =
            err instanceof Error
              ? `Could not reach the server (${err.message})`
              : 'Could not reach the server'
          for (let r = 0; r < chunk.length; r++) {
            result.errors.push({ row: i + r + 1, message })
          }
          onProgress?.(Math.min(i + CHUNK_SIZE, rows.length), rows.length)
          continue
        }

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
          // One error per row, not one per batch. A failed chunk takes 500
          // rows with it, and recording a single entry made the summary claim
          // "1 error" — so created + updated + skipped + errors came to 499
          // short of the file, with no sign anything was missing. Those totals
          // reconciling is how an operator knows nothing was silently dropped,
          // and naming every row is also what makes a retry possible.
          for (let r = 0; r < chunk.length; r++) {
            result.errors.push({ row: i + r + 1, message })
          }
        } else {
          // The body can still be lost in transit after a 200 — the same
          // dropped connection, a few milliseconds later. The rows may well
          // have landed, so say so rather than claiming they failed.
          try {
            const data = (await response.json()) as Omit<ImportResult, 'total'>
            result.created += data.created ?? 0
            result.updated += data.updated ?? 0
            result.skipped += data.skipped ?? 0
            result.duplicatesInFile += data.duplicatesInFile ?? 0
            if (data.errors?.length) result.errors.push(...data.errors)
          } catch {
            for (let r = 0; r < chunk.length; r++) {
              result.errors.push({
                row: i + r + 1,
                message:
                  'The server accepted these rows but the reply was lost, so they are unconfirmed. Re-run the file to be sure.',
              })
            }
          }
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
