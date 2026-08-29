'use client'

// Which sequences people are actually in.
//
// "22 automations" is a count of things that exist; this is the count of
// things doing something. Only automations with someone enrolled appear, so
// the panel is short by construction rather than a list of 22 mostly-idle rows.

import Link from 'next/link'
import { Zap } from 'lucide-react'
import type { DashboardOverview } from '@/lib/hooks/useDashboardOverview'
import { Skeleton } from '@/components/ui/skeleton'

export function AutomationsAtWork({
  data,
  isLoading,
}: {
  data?: DashboardOverview
  isLoading?: boolean
}) {
  const rows = data?.top_automations ?? []
  const max = Math.max(1, ...rows.map((r) => r.enrolled))

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Automations at work
          </h2>
        </div>
        <Link href="/automations" className="text-xs font-medium text-blue-600 hover:underline">
          All {data ? data.automation.active : ''}
        </Link>
      </div>

      <div className="p-4">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">
            {data?.automation.active
              ? `${data.automation.active} automations are active, with nobody currently enrolled.`
              : 'No active automations.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-2.5">
                <span className="w-40 shrink-0 truncate text-xs text-slate-600 dark:text-slate-300">
                  {r.name}
                </span>
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <span
                    className="block h-full rounded-full bg-violet-500"
                    style={{ width: `${Math.max(6, (r.enrolled / max) * 100)}%` }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-500">
                  {r.enrolled} in it
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
