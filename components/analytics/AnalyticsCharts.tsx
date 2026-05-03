'use client'

// Two-chart layout. The previous design had eight charts in a grid
// which the client called cluttered. We now show:
//
//   1. Performance over time — combo line+bar showing leads
//      generated AND revenue earned across the date range. One panel,
//      two stories. Tells "is volume growing AND money flowing in?".
//   2. Pipeline funnel — horizontal bars of how many records sit at
//      each stage. Tells "where does the pipeline thin out?".
//
// Anything finer-grained (per-recruiter, per-programme, per-source,
// per-stage timing) belongs on the Reports page or contact-level
// dashboards rather than this top-of-funnel summary.

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ComposedChart,
  Bar,
  Line,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { AnalyticsData } from '@/lib/hooks/useAnalytics'

interface AnalyticsChartsProps {
  isLoading?: boolean
  data?: Omit<AnalyticsData, 'kpis'>
}

const tooltipStyle = {
  backgroundColor: 'var(--color-card, white)',
  border: '1px solid var(--color-border, #E5E7EB)',
  borderRadius: '8px',
  color: 'var(--color-card-foreground, #1f2937)',
  fontSize: '12px',
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)

const formatCompactGBP = (value: number) => {
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `£${(value / 1_000).toFixed(0)}k`
  return `£${value}`
}

export function AnalyticsCharts({ isLoading, data }: AnalyticsChartsProps) {
  // ResponsiveContainer needs a real DOM box at first paint, so wait
  // for client-side mount before rendering Recharts.
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => setIsMounted(true), [])

  const leadsOverTime = data?.leadsOverTime ?? []
  const revenueByMonth = data?.revenueByMonth ?? []
  const pipelineFunnel = data?.pipelineFunnel ?? []

  // Combo dataset: align leads-by-day with revenue-by-month for the
  // composed chart. The hooks return them on different cadences
  // (daily vs monthly) so we anchor to leadsOverTime's date stamps
  // and look up the matching month for revenue. When revenue is only
  // available monthly the line shows a per-month plateau, which still
  // reads as a useful trend.
  const performanceSeries = leadsOverTime.map((row) => {
    // row.date is "DD/MM" — parse the month label by rebuilding a
    // short month string ("Jan", "Feb", ...) from the date string.
    const [day, month] = row.date.split('/')
    const monthIdx = month ? parseInt(month, 10) - 1 : 0
    const monthLabel = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][monthIdx]
    const monthRow = revenueByMonth.find((m) =>
      m.month.toLowerCase().startsWith((monthLabel ?? '').toLowerCase()),
    )
    void day
    return {
      date: row.date,
      leads: row.leads,
      revenue: monthRow?.revenue ?? 0,
    }
  })

  if (isLoading || !isMounted) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[320px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[320px] w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Performance over time — leads (bar, blue) + revenue (line,
          emerald) on a dual y-axis. Spans 2/3 of the row so the trend
          line has room to breathe. */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Performance over time</CardTitle>
          <p className="text-xs text-muted-foreground">
            Leads generated vs revenue earned, across the selected date range.
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[320px]">
            {performanceSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={performanceSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11 }}
                    stroke="#3B82F6"
                    label={{
                      value: 'Leads',
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 11, fill: '#3B82F6' },
                    }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    stroke="#10B981"
                    tickFormatter={formatCompactGBP}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => {
                      if (name === 'Revenue') return [formatCurrency(value as number), name]
                      return [value, name]
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    yAxisId="left"
                    dataKey="leads"
                    name="Leads"
                    fill="#3B82F6"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    dot={{ fill: '#10B981', strokeWidth: 0, r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No data for the selected period.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pipeline funnel — horizontal bars showing how many records
          sit at each stage. Spans 1/3, sits beside performance. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline funnel</CardTitle>
          <p className="text-xs text-muted-foreground">
            Where deals are clustered today.
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[320px]">
            {pipelineFunnel.length > 0 && pipelineFunnel.some((s) => s.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineFunnel} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                  <YAxis
                    dataKey="stage"
                    type="category"
                    tick={{ fontSize: 11 }}
                    stroke="#9CA3AF"
                    width={90}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No deals in the pipeline yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
