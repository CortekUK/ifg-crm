'use client'

// The chart half of Analytics: lead volume, where leads come from,
// where deals sit, and revenue by month.
//
// Every series here is read straight from analytics_overview(). Nothing
// is derived in the browser, so what the chart draws is what the database
// counted.

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AnalyticsData } from '@/lib/hooks/useAnalytics'

const tooltipStyle = {
  backgroundColor: 'var(--color-card, white)',
  border: '1px solid var(--color-border, #E5E7EB)',
  borderRadius: '8px',
  color: 'var(--color-card-foreground, #1f2937)',
  fontSize: '12px',
}

const compactGBP = (value: number) => {
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `£${(value / 1_000).toFixed(0)}k`
  return `£${value}`
}

const SOURCE_COLOURS = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#64748B',
]

/** Turn `website_form` into `Website form`. */
function humanise(value: string) {
  const spaced = value.replace(/[_:]/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function Panel({
  title,
  subtitle,
  children,
  isLoading,
  isEmpty,
  emptyMessage,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  isLoading?: boolean
  isEmpty?: boolean
  emptyMessage?: string
}) {
  return (
    <Card className="flex h-full flex-col border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
          {title}
        </CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        {isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : isEmpty ? (
          <div className="grid h-[220px] place-items-center text-center text-sm text-muted-foreground">
            {emptyMessage || 'Nothing recorded in this period.'}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}

export function AnalyticsCharts({
  isLoading,
  data,
}: {
  isLoading?: boolean
  data?: AnalyticsData
}) {
  const leads = data?.leads_over_time ?? []
  const sources = (data?.lead_sources ?? []).map((s, i) => ({
    ...s,
    label: humanise(s.name),
    fill: SOURCE_COLOURS[i % SOURCE_COLOURS.length],
  }))
  const funnel = data?.funnel ?? []
  const revenue = data?.revenue_by_month ?? []

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title="Leads over time"
        subtitle="New contacts per week"
        isLoading={isLoading}
        isEmpty={leads.every((d) => d.leads === 0)}
      >
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={leads} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="leadFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area
              type="monotone"
              dataKey="leads"
              name="Leads"
              stroke="#3B82F6"
              strokeWidth={2}
              fill="url(#leadFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      <Panel
        title="Where leads come from"
        subtitle="Contacts created in this period, by source"
        isLoading={isLoading}
        isEmpty={sources.length === 0}
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={sources}
            layout="vertical"
            margin={{ top: 4, right: 32, left: 8, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              width={130}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
            <Bar dataKey="value" name="Leads" radius={[0, 4, 4, 0]} barSize={16}>
              {sources.map((s) => (
                <Cell key={s.name} fill={s.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel
        title="Pipeline funnel"
        subtitle="Deals sitting at each stage right now — all time, not just this period"
        isLoading={isLoading}
        isEmpty={funnel.every((f) => f.count === 0)}
      >
        <ResponsiveContainer width="100%" height={Math.max(220, funnel.length * 24)}>
          <BarChart
            data={funnel}
            layout="vertical"
            margin={{ top: 4, right: 32, left: 8, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="stage"
              width={150}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
            <Bar dataKey="count" name="Deals" fill="#6366F1" radius={[0, 4, 4, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel
        title="Revenue by month"
        subtitle="Successful payments, last six months"
        isLoading={isLoading}
        isEmpty={revenue.every((r) => r.revenue === 0)}
        emptyMessage="No payments recorded yet. Revenue appears here once Stripe confirms a payment against an invoice."
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={revenue} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={compactGBP}
            />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => compactGBP(Number(v ?? 0))} />
            <Bar dataKey="revenue" name="Revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  )
}
