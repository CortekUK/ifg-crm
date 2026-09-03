'use client'

// Headline figures.
//
// Deltas come from deltaPercent(), which returns null when the previous
// period had nothing to compare against — so a first month reads as a
// first month rather than as "+100%".

import { Users, GitBranch, Trophy, PoundSterling, Wallet, FileWarning } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { deltaPercent, type AnalyticsData } from '@/lib/hooks/useAnalytics'

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

const round = (n: number | null) => (n == null ? null : Math.round(n))

export function AnalyticsKPIs({ isLoading, data }: Props) {
  const k = data?.kpis
  const winRate = k && k.deals > 0 ? ((k.deals_won / k.deals) * 100).toFixed(1) : '0.0'

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        label="New leads"
        value={(k?.leads ?? 0).toLocaleString()}
        icon={Users}
        delta={k ? round(deltaPercent(k.leads, k.leads_previous)) : null}
        deltaLabel="vs previous"
        isLoading={isLoading}
        href="/contacts"
        hint="Contacts created during the selected period."
      />
      <KpiCard
        label="Deals created"
        value={(k?.deals ?? 0).toLocaleString()}
        icon={GitBranch}
        delta={k ? round(deltaPercent(k.deals, k.deals_previous)) : null}
        deltaLabel="vs previous"
        isLoading={isLoading}
        href="/pipelines"
        hint="Deals created during the selected period, in the selected programme."
      />
      <KpiCard
        label="Deals won"
        value={(k?.deals_won ?? 0).toLocaleString()}
        detail={`${winRate}% of deals created`}
        icon={Trophy}
        delta={k ? round(deltaPercent(k.deals_won, k.deals_won_previous)) : null}
        deltaLabel="vs previous"
        isLoading={isLoading}
        hint="Deals created in this period that have since been marked won."
      />
      <KpiCard
        label="Revenue"
        value={money(k?.revenue ?? 0)}
        icon={PoundSterling}
        delta={k ? round(deltaPercent(k.revenue, k.revenue_previous)) : null}
        deltaLabel="vs previous"
        isLoading={isLoading}
        hint="Successful payments received during the period. Not deal values — money that actually arrived."
      />
      <KpiCard
        label="Open pipeline"
        value={money(k?.open_value ?? 0)}
        detail="value of live deals"
        icon={Wallet}
        isLoading={isLoading}
        href="/pipelines"
        hint="Total value of deals created in this period that are still open."
      />
      <KpiCard
        label="Outstanding"
        value={money(k?.outstanding ?? 0)}
        detail="unpaid invoices"
        icon={FileWarning}
        tone={(k?.outstanding ?? 0) > 0 ? 'warning' : 'default'}
        isLoading={isLoading}
        href="/invoices"
        hint="Sent, viewed or overdue invoices — all time, not just this period."
      />
    </div>
  )
}
