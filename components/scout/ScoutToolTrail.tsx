'use client'

// Tool-call trail item — appears under the assistant bubble while Scout is
// consulting a data source. Three states:
//   running  — pulsing amber dot, "Running…" label.
//   done     — emerald dot, count, sample preview when expanded.
//   error    — red dot, error text inline.
//
// Expanded view shows up to 3 sample rows as a key/value mini-table (no
// raw JSON dump). Power users can hit "Show raw" to fall back to JSON if
// they really need it.

import { useState } from 'react'
import { ChevronRight, Code2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScoutToolEvent } from '@/lib/hooks/useScoutChat'

// Column priority for the preview — the model's tool result sample tends to
// have many columns, but only a few are useful at a glance. We bubble the
// most "identity" / "status" columns to the front and drop the rest.
const PRIORITY_COLUMNS = [
  'full_name',
  'name',
  'contact_name',
  'title',
  'email',
  'phone',
  'pipeline_name',
  'stage_name',
  'status',
  'amount',
  'days_overdue',
  'intent',
  'days_in_current_stage',
  'created_at',
  'updated_at',
  'occurred_at',
]

const TOOL_LABELS: Record<string, string> = {
  query_contacts: 'Searched contacts',
  query_deals: 'Searched deals',
  query_invoices: 'Searched invoices',
  query_automations: 'Looked up automations',
  query_pipeline_state: 'Read pipeline state',
  query_lists: 'Looked up lists',
  query_list_members: 'Looked up list members',
  query_communications: 'Searched communications',
  query_form_submissions: 'Searched form submissions',
  query_calendar: 'Read calendar',
  query_users: 'Looked up users',
  query_metrics: 'Read platform metrics',
  execute_readonly_sql: 'Ran a custom SQL query',
}

interface ScoutToolTrailItemProps {
  event: ScoutToolEvent
}

export function ScoutToolTrailItem({ event }: ScoutToolTrailItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  const label = TOOL_LABELS[event.name] ?? event.name
  const result = event.result as
    | { count?: number; error?: string; sample?: unknown }
    | undefined

  const summary = (() => {
    if (event.status === 'running') return 'Running…'
    if (result?.error) return `Error`
    if (typeof result?.count === 'number') {
      return `${result.count} ${result.count === 1 ? 'row' : 'rows'}`
    }
    return 'Done'
  })()

  const hasRows = Array.isArray(result?.sample) && result.sample.length > 0
  const isExpandable = hasRows || !!result?.error || event.status !== 'running'

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-gradient-to-br transition-all',
        'border-slate-200/80 from-white to-slate-50/60',
        'dark:border-slate-700/60 dark:from-slate-800/40 dark:to-slate-900/40',
        expanded && 'shadow-sm',
      )}
    >
      <button
        type="button"
        disabled={!isExpandable}
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] transition',
          isExpandable && 'hover:bg-white/60 dark:hover:bg-slate-800/50',
        )}
      >
        <StatusDot status={event.status} />
        <span className="flex-1 truncate text-slate-700 dark:text-slate-200">
          {label}
        </span>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
            event.status === 'error'
              ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              : event.status === 'running'
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
          )}
        >
          {summary}
        </span>
        {isExpandable && (
          <ChevronRight
            className={cn(
              'h-3 w-3 shrink-0 text-slate-400 transition-transform',
              expanded && 'rotate-90',
            )}
          />
        )}
      </button>

      {expanded && (
        <div className="border-t border-slate-200/70 bg-white/60 px-3 py-2 dark:border-slate-700/60 dark:bg-slate-900/40">
          {result?.error ? (
            <p className="text-[11px] text-red-700 dark:text-red-300">{result.error}</p>
          ) : hasRows && !showRaw ? (
            <RowsPreview rows={result.sample as Record<string, unknown>[]} />
          ) : null}

          {result && (
            <div className="mt-1 flex items-center justify-between">
              {showRaw ? (
                <pre className="max-h-48 w-full overflow-auto rounded-md bg-slate-900 p-2 text-[10px] leading-relaxed text-slate-100 dark:bg-slate-950">
                  {JSON.stringify(result, null, 2)}
                </pre>
              ) : (
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  {hasRows
                    ? `Showing ${Math.min((result.sample as unknown[]).length, 3)} of ${result.count ?? '?'}`
                    : 'No preview available'}
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowRaw((v) => !v)}
                className={cn(
                  'ml-auto flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px]',
                  'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
                  'dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
                  showRaw && 'text-slate-700 dark:text-slate-200',
                )}
              >
                <Code2 className="h-3 w-3" />
                {showRaw ? 'Hide raw' : 'Show raw'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: ScoutToolEvent['status'] }) {
  return (
    <span
      className={cn(
        'h-1.5 w-1.5 shrink-0 rounded-full',
        status === 'running'
          ? 'animate-pulse bg-amber-500'
          : status === 'error'
            ? 'bg-red-500'
            : 'bg-emerald-500',
      )}
    />
  )
}

// Renders up to 3 rows as a compact table — column headers shown ONCE at
// the top, values stacked below. Picks the most useful columns per dataset
// so the user sees identity + status at a glance instead of a sea of UUIDs.
function RowsPreview({ rows }: { rows: Record<string, unknown>[] }) {
  const sample = rows.slice(0, 3)
  // Column set is derived from the first row (rows from the same view share
  // a shape); fall back to a union if the first row is sparse.
  const columns = pickPreviewColumns(sample[0] ?? {})
  if (columns.length === 0) return null

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200/70 bg-white/80 dark:border-slate-700/50 dark:bg-slate-800/40">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-slate-50/80 dark:bg-slate-800/70">
            {columns.map((c) => (
              <th
                key={c}
                className="border-b border-slate-200/70 px-2 py-1 text-left font-semibold text-slate-500 dark:border-slate-700/50 dark:text-slate-400"
              >
                {prettifyKey(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sample.map((row, idx) => (
            <tr
              key={idx}
              className="border-b border-slate-100 last:border-0 dark:border-slate-800"
            >
              {columns.map((c) => {
                const v = row[c]
                const text = formatCell(v)
                return (
                  <td
                    key={c}
                    className={cn(
                      'px-2 py-1 align-top leading-snug',
                      isUuid(String(v))
                        ? 'font-mono text-[10px] text-slate-400 dark:text-slate-500'
                        : 'text-slate-700 dark:text-slate-200',
                    )}
                  >
                    {text}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function pickPreviewColumns(row: Record<string, unknown>): string[] {
  const present = Object.keys(row)
  const picked: string[] = []
  for (const c of PRIORITY_COLUMNS) {
    if (present.includes(c) && row[c] !== null && row[c] !== undefined && row[c] !== '') {
      picked.push(c)
    }
    if (picked.length >= 5) break
  }
  // Fallback if none of the priority cols match — show first 4 non-null.
  if (picked.length === 0) {
    for (const c of present) {
      if (row[c] !== null && row[c] !== undefined && row[c] !== '') picked.push(c)
      if (picked.length >= 4) break
    }
  }
  return picked
}

function prettifyKey(k: string): string {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2)
  if (typeof v === 'string') {
    // Trim ISO timestamps to a friendlier form.
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
      const d = new Date(v)
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      }
    }
    return v
  }
  if (Array.isArray(v)) return `[${v.length} items]`
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
