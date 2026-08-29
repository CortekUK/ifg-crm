'use client'

// Where the open deals actually are.
//
// Grouped by pipeline, because three programmes share one board and a single
// merged bar chart hid which programme a deal belonged to. Closed, lost and
// dormant stages are excluded by the query — they are history, not workload.

import Link from 'next/link'
import { GitBranch } from 'lucide-react'
import type { DashboardOverview } from '@/lib/hooks/useDashboardOverview'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/format'

export function PipelineHealth({
  data,
  isLoading,
}: {
  data?: DashboardOverview
  isLoading?: boolean
}) {
  const stages = data?.by_stage ?? []
  const max = Math.max(1, ...stages.map((s) => s.count))

  const byPipeline = stages.reduce<Record<string, typeof stages>>((acc, s) => {
    ;(acc[s.pipeline] ||= []).push(s)
    return acc
  }, {})

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Where the deals are
          </h2>
        </div>
        <Link href="/pipelines" className="text-xs font-medium text-blue-600 hover:underline">
          Pipelines
        </Link>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : stages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No open deals in any active pipeline.
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(byPipeline).map(([pipeline, rows]) => (
              <div key={pipeline}>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {pipeline}
                </p>
                <div className="space-y-1.5">
                  {rows.map((s) => (
                    <div key={`${pipeline}-${s.stage}`} className="flex items-center gap-2.5">
                      <span className="w-32 shrink-0 truncate text-xs text-slate-600 dark:text-slate-300">
                        {s.stage}
                      </span>
                      <span className="h-4 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${Math.max(4, (s.count / max) * 100)}%`,
                            backgroundColor: s.colour || '#3b82f6',
                          }}
                        />
                      </span>
                      <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-900 dark:text-white">
                        {s.count}
                      </span>
                      <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-slate-400">
                        {s.value > 0 ? formatCurrency(s.value) : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
