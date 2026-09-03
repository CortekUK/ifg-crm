'use client'

// Programme and recruiter tables, plus the two operational panels
// (email engagement and automation health).
//
// The email panel is deliberate about a gap: opens and clicks only exist
// if Resend is posting delivery events back. When no send in the period
// carries any tracking event, the panel says so rather than reporting
// "0% open rate", which would read as nobody opening the emails.

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Mail, Zap, Trophy, Users } from 'lucide-react'
import type { AnalyticsData } from '@/lib/hooks/useAnalytics'

interface Props {
  isLoading?: boolean
  data?: AnalyticsData
}

const money = (value: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value)

function Shell({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof Mail
  children: React.ReactNode
}) {
  return (
    <Card className="flex h-full flex-col border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <Icon className="h-4 w-4 text-slate-400" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-0">{children}</CardContent>
    </Card>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/60">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          tone === 'warn'
            ? 'mt-0.5 text-lg font-bold tabular-nums text-amber-600'
            : 'mt-0.5 text-lg font-bold tabular-nums text-slate-900 dark:text-white'
        }
      >
        {value}
      </p>
    </div>
  )
}

function Rows({
  isLoading,
  rows,
  empty,
}: {
  isLoading?: boolean
  rows: { key: string; name: string; cells: string[] }[]
  empty: string
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    )
  }
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
  }
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center justify-between gap-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
            {row.name}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {row.cells.join(' · ')}
          </span>
        </div>
      ))}
    </div>
  )
}

export function AnalyticsBreakdown({ isLoading, data }: Props) {
  const email = data?.email
  const automation = data?.automation
  const trackingActive = (email?.tracked ?? 0) > 0
  const openRate =
    email && email.sent > 0 ? ((email.opened / email.sent) * 100).toFixed(1) : '0.0'

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
      <Shell title="Programmes" icon={Trophy}>
        <Rows
          isLoading={isLoading}
          rows={(data?.programmes ?? []).map((p) => ({
            key: p.programme,
            name: p.programme,
            cells: [
              `${p.deals} ${p.deals === 1 ? 'deal' : 'deals'}`,
              `${p.won} won`,
              money(p.value),
            ],
          }))}
          empty="No programmes yet."
        />
      </Shell>

      <Shell title="Recruiters" icon={Users}>
        <Rows
          isLoading={isLoading}
          rows={(data?.recruiters ?? []).map((r) => ({
            key: r.name,
            name: r.name,
            cells: [
              `${r.deals} ${r.deals === 1 ? 'deal' : 'deals'}`,
              `${r.won} won`,
              money(r.value),
            ],
          }))}
          empty="No deals were assigned to anyone in this period."
        />
      </Shell>

      <Shell title="Email engagement" icon={Mail}>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Sent" value={(email?.sent ?? 0).toLocaleString()} />
              <Stat label="Replies" value={(email?.replies ?? 0).toLocaleString()} />
              <Stat
                label="Open rate"
                value={trackingActive ? `${openRate}%` : '—'}
              />
              <Stat
                label="Failed"
                value={(email?.failed ?? 0).toLocaleString()}
                tone={(email?.failed ?? 0) > 0 ? 'warn' : undefined}
              />
            </div>
            {!trackingActive && (email?.sent ?? 0) > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                No delivery or open events have come back for these sends, so an open rate
                cannot be calculated. This means the Resend webhook is not reporting yet —
                not that nobody opened them.
              </p>
            )}
          </>
        )}
      </Shell>

      <Shell title="Automation health" icon={Zap}>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Active" value={(automation?.active ?? 0).toLocaleString()} />
            <Stat label="Enrolled" value={(automation?.enrolled ?? 0).toLocaleString()} />
            <Stat label="Steps sent" value={(automation?.sent ?? 0).toLocaleString()} />
            <Stat
              label="Failed"
              value={(automation?.failed ?? 0).toLocaleString()}
              tone={(automation?.failed ?? 0) > 0 ? 'warn' : undefined}
            />
          </div>
        )}
      </Shell>
    </div>
  )
}
