'use client'

// Three-KPI overview. The previous design surfaced 10 cards in a
// 3-column grid which the client found cluttered — strategy now is
// "headline metrics only": volume → efficiency → revenue. Anything
// finer-grained lives in the charts below or on the dedicated
// invoices / replies pages.

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Users, Target, PoundSterling, TrendingUp, TrendingDown } from 'lucide-react'
import type { AnalyticsData } from '@/lib/hooks/useAnalytics'

interface AnalyticsKPIsProps {
  isLoading?: boolean
  data?: AnalyticsData['kpis']
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

interface KPI {
  title: string
  value: string
  change: number
  changeLabel: string
  icon: React.ElementType
  accent: 'blue' | 'emerald' | 'violet'
}

const accents: Record<KPI['accent'], { tile: string; icon: string; border: string }> = {
  blue: {
    tile: 'bg-blue-50 dark:bg-blue-950/40',
    icon: 'text-blue-600 dark:text-blue-400',
    border: 'border-l-blue-500',
  },
  emerald: {
    tile: 'bg-emerald-50 dark:bg-emerald-950/40',
    icon: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-l-emerald-500',
  },
  violet: {
    tile: 'bg-violet-50 dark:bg-violet-950/40',
    icon: 'text-violet-600 dark:text-violet-400',
    border: 'border-l-violet-500',
  },
}

export function AnalyticsKPIs({ isLoading, data }: AnalyticsKPIsProps) {
  const kpis: KPI[] = [
    {
      title: 'Total leads',
      value: data?.totalLeads?.toLocaleString() ?? '0',
      change: data ? pctChange(data.totalLeads, data.totalLeadsPrevious) : 0,
      changeLabel: 'vs last period',
      icon: Users,
      accent: 'blue',
    },
    {
      title: 'Conversion rate',
      value: `${(data?.conversionRate ?? 0).toFixed(1)}%`,
      change: data ? data.conversionRate - data.conversionRatePrevious : 0,
      changeLabel: 'vs last period',
      icon: Target,
      accent: 'violet',
    },
    {
      title: 'Revenue',
      value: formatCurrency(data?.revenue ?? 0),
      change: data ? pctChange(data.revenue, data.revenuePrevious) : 0,
      changeLabel: 'vs last period',
      icon: PoundSterling,
      accent: 'emerald',
    },
  ]

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map((_, i) => (
          <Card key={i} className="border-l-4 border-l-slate-200 dark:border-l-slate-700">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-9 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-28 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon
        const a = accents[kpi.accent]
        const isPositive = kpi.change >= 0
        return (
          <Card
            key={kpi.title}
            className={cn(
              'border-l-4 bg-white shadow-sm transition-shadow hover:shadow dark:bg-slate-900',
              a.border,
            )}
          >
            <CardContent className="p-5">
              <div className="mb-3 flex items-start justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {kpi.title}
                </p>
                <div className={cn('grid h-9 w-9 place-items-center rounded-lg', a.tile)}>
                  <Icon className={cn('h-4 w-4', a.icon)} />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {kpi.value}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                {isPositive ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                )}
                <span
                  className={cn(
                    'font-medium',
                    isPositive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400',
                  )}
                >
                  {isPositive ? '+' : ''}
                  {kpi.change.toFixed(1)}%
                </span>
                <span className="text-muted-foreground">{kpi.changeLabel}</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
