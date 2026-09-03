'use client'

// Stage conversion and time-in-stage.
//
// Both used to be hardcoded empty arrays behind a comment saying the
// `deal_stage_history` table did not exist yet. It does, and has since
// the pipeline was first used — so these are the two figures that
// actually answer "where is the pipeline leaking, and where does it
// stall?".

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { TrendingDown, Timer } from 'lucide-react'
import type { AnalyticsData } from '@/lib/hooks/useAnalytics'

interface Props {
  isLoading?: boolean
  data?: AnalyticsData
}

function Shell({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string
  subtitle: string
  icon: typeof Timer
  children: React.ReactNode
}) {
  return (
    <Card className="flex h-full flex-col border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <Icon className="h-4 w-4 text-slate-400" />
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="flex-1 pt-0">{children}</CardContent>
    </Card>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-[180px] place-items-center px-4 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

export function StagePerformance({ isLoading, data }: Props) {
  const conversion = data?.stage_conversion ?? []
  const timing = data?.time_in_stage ?? []
  const slowest = Math.max(1, ...timing.map((t) => t.avg_days))

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Shell
        title="Stage conversion"
        subtitle="Of the deals that reached each stage, how many moved on"
        icon={TrendingDown}
      >
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : conversion.length === 0 ? (
          <Empty>No stage movements recorded in this period.</Empty>
        ) : (
          <div className="space-y-3">
            {conversion.map((row) => (
              <div key={row.stage}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                    {row.stage}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {row.advanced}/{row.entered}
                    <span
                      className={cn(
                        'ml-2 font-semibold',
                        row.rate >= 75
                          ? 'text-emerald-600'
                          : row.rate >= 40
                            ? 'text-amber-600'
                            : 'text-red-600',
                      )}
                    >
                      {row.rate}%
                    </span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      row.rate >= 75
                        ? 'bg-emerald-500'
                        : row.rate >= 40
                          ? 'bg-amber-500'
                          : 'bg-red-500',
                    )}
                    style={{ width: `${Math.min(100, row.rate)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Shell>

      <Shell
        title="Time in stage"
        subtitle="Average days before a deal moves on. Deals still sitting in a stage are not counted yet."
        icon={Timer}
      >
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : timing.length === 0 ? (
          <Empty>
            No completed stage moves in this period, so there is nothing to average yet.
          </Empty>
        ) : (
          <div className="space-y-3">
            {timing.map((row) => (
              <div key={row.stage}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                    {row.stage}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {row.avg_days < 1
                        ? `${Math.round(row.avg_days * 24)}h`
                        : `${row.avg_days}d`}
                    </span>
                    <span className="ml-2">
                      {row.samples} {row.samples === 1 ? 'deal' : 'deals'}
                    </span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${Math.max(3, (row.avg_days / slowest) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Shell>
    </div>
  )
}
