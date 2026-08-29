'use client'

// The dashboard.
//
// What it replaces: four stat cards carrying invented sparklines, four widgets
// about unmatched replies (all empty in this database), a revenue card reading
// £0, and no mention of contacts, campaigns, brochures, templates, lists or
// tags — most of what the CRM does.
//
// Two principles here. Every figure is counted in SQL by dashboard_overview(),
// because anything summed in the browser is summed over at most 1000 rows and
// this database holds 105,285 contacts. And nothing is drawn that isn't real:
// no sparkline without history behind it, no percentage of a zero baseline,
// no queue rendered as four empty boxes.

import { useState } from 'react'
import {
  Activity,
  BadgePoundSterling,
  CalendarCheck,
  Mail,
  Receipt,
  Users,
  Zap,
} from 'lucide-react'
import { useDashboardOverview, deltaPercent } from '@/lib/hooks/useDashboardOverview'
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { NeedsAttention } from '@/components/dashboard/NeedsAttention'
import { PipelineHealth } from '@/components/dashboard/PipelineHealth'
import { AutomationsAtWork } from '@/components/dashboard/AutomationsAtWork'
import { MarketingSnapshot } from '@/components/dashboard/MarketingSnapshot'
import { AudienceSnapshot } from '@/components/dashboard/AudienceSnapshot'
import { RecentActivityTimeline } from '@/components/dashboard/RecentActivityTimeline'
import { CreateContactModal } from '@/components/contacts/CreateContactModal'
import { formatCurrency, formatNumber } from '@/lib/utils/format'

export default function DashboardPage() {
  const { data, isLoading, error } = useDashboardOverview()
  const [createContactOpen, setCreateContactOpen] = useState(false)

  const attention = data
    ? data.attention.unmatched_sms +
      data.attention.unmatched_email +
      data.attention.overdue_invoices +
      data.deals.stalled
    : 0

  return (
    <div className="space-y-4">
      <WelcomeBanner onNewLead={() => setCreateContactOpen(true)} />

      <QuickActions onNewContact={() => setCreateContactOpen(true)} />

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950">
          Could not load the dashboard figures: {error.message}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          label="Contacts"
          value={formatNumber(data?.contacts.total ?? 0)}
          detail={data ? `${formatNumber(data.contacts.added_7d)} added this week` : undefined}
          delta={data ? deltaPercent(data.contacts.added_7d, data.contacts.added_prev_7d) : null}
          deltaLabel="vs last week"
          icon={Users}
          href="/contacts"
          isLoading={isLoading}
        />
        <KpiCard
          label="Open deals"
          value={formatNumber(data?.deals.open ?? 0)}
          detail={data ? formatCurrency(data.deals.open_value) : undefined}
          delta={
            data
              ? deltaPercent(data.deals.created_this_month, data.deals.created_last_month)
              : null
          }
          deltaLabel="new vs last month"
          icon={BadgePoundSterling}
          href="/pipelines"
          isLoading={isLoading}
        />
        <KpiCard
          label="Automations"
          value={formatNumber(data?.automation.active ?? 0)}
          detail={data ? `${formatNumber(data.automation.enrolled)} people enrolled` : undefined}
          icon={Zap}
          href="/automations"
          isLoading={isLoading}
        />
        <KpiCard
          label="Emails sent"
          value={formatNumber(data?.email.sent_7d ?? 0)}
          detail={
            data
              ? `${formatNumber(data.email.sent_today)} today · ${formatNumber(data.email.opened_7d)} opened`
              : undefined
          }
          icon={Mail}
          href="/campaigns"
          isLoading={isLoading}
        />
        <KpiCard
          label="Needs attention"
          value={formatNumber(attention)}
          detail={attention === 0 ? 'all clear' : 'replies, invoices, stalled deals'}
          icon={Activity}
          tone={attention > 0 ? 'warning' : 'good'}
          isLoading={isLoading}
        />
      </div>

      <NeedsAttention data={data} isLoading={isLoading} />

      {/* The left column sets the height and the timeline fills it, scrolling
          its own list. Stretching the short card was wrong; so was letting the
          tall one leave a hole beneath the short one. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <PipelineHealth data={data} isLoading={isLoading} />
          <AutomationsAtWork data={data} isLoading={isLoading} />
        </div>
        <RecentActivityTimeline />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* The headline is the current state, which is a fact: this many deals
            are sitting in a call stage. "Calls booked" was an interpretation —
            the CRM never learns whether a call happened, only that a card was
            moved, and the stages are named differently per pipeline (Zoom
            Scheduled, Interview), so no single label can define itself. */}
        <KpiCard
          label="Awaiting a call"
          value={formatNumber(data?.meetings.waiting_now ?? 0)}
          detail={
            data ? `${formatNumber(data.meetings.this_month)} entered this month` : undefined
          }
          hint="Deals sitting in a call stage right now — Zoom Scheduled, or Interview on the University pipeline. Counted per deal, not per move."
          icon={CalendarCheck}
          href="/pipelines"
          isLoading={isLoading}
        />
        <KpiCard
          label="Paid this month"
          value={formatCurrency(data?.finance.paid_this_month ?? 0)}
          delta={
            data ? deltaPercent(data.finance.paid_this_month, data.finance.paid_last_month) : null
          }
          deltaLabel="vs last month"
          icon={BadgePoundSterling}
          href="/invoices"
          isLoading={isLoading}
        />
        <KpiCard
          label="Outstanding"
          value={formatCurrency(data?.finance.outstanding ?? 0)}
          detail={
            data ? `${formatNumber(data.finance.outstanding_count)} unpaid invoices` : undefined
          }
          icon={Receipt}
          tone={data && data.attention.overdue_invoices > 0 ? 'warning' : 'default'}
          href="/invoices"
          isLoading={isLoading}
        />
      </div>

      <MarketingSnapshot data={data} isLoading={isLoading} />

      <AudienceSnapshot data={data} isLoading={isLoading} />

      <CreateContactModal
        isOpen={createContactOpen}
        onClose={() => setCreateContactOpen(false)}
      />
    </div>
  )
}
