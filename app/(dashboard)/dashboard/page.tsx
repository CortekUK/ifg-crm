'use client'

import { useState, useMemo } from 'react'
import { useDashboardStats } from '@/lib/hooks/useDashboardStats'
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner'
import { DashboardStatsCard } from '@/components/dashboard/DashboardStatsCard'
import { UnmatchedRepliesWidget } from '@/components/dashboard/UnmatchedRepliesWidget'
import { FollowUpsWidget } from '@/components/dashboard/FollowUpsWidget'
import { LeadSourcesChart } from '@/components/dashboard/LeadSourcesChart'
import { ProgrammeInterestChart } from '@/components/dashboard/ProgrammeInterestChart'
import { DealsByStageChart } from '@/components/dashboard/DealsByStageChart'
import { CallsBookedCard } from '@/components/dashboard/CallsBookedCard'
import { RevenueSummaryCard } from '@/components/dashboard/RevenueSummaryCard'
import { RecentActivityTimeline } from '@/components/dashboard/RecentActivityTimeline'
import { CreateContactModal } from '@/components/contacts/CreateContactModal'
import { formatNumber } from '@/lib/utils/format'
import {
  Users,
  MessageSquareWarning,
  GraduationCap,
  Activity,
} from 'lucide-react'

// Seeded pseudo-random for stable sparkline data across renders
function seededRandom(seed: number) {
  const values: number[] = []
  for (let i = 0; i < 12; i++) {
    seed = (seed * 16807 + 0) % 2147483647
    values.push((seed % 10) + 2)
  }
  return values
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats()
  const [createContactOpen, setCreateContactOpen] = useState(false)

  // Stable sparkline data — only regenerate when stats change
  const sparklines = useMemo(() => ({
    leads: seededRandom(1),
    unmatched: seededRandom(2),
    programmes: seededRandom(3),
    activity: seededRandom(4),
  }), [])

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <WelcomeBanner onNewLead={() => setCreateContactOpen(true)} />

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardStatsCard
          title="Total Leads"
          value={formatNumber(stats?.totalLeads || 0)}
          icon={Users}
          trend={stats?.totalLeadsTrend}
          trendLabel="vs last month"
          colour="blue"
          sparklineData={sparklines.leads}
          isLoading={isLoading}
          href="/pipelines"
        />
        <DashboardStatsCard
          title="Unmatched Replies"
          value={formatNumber(stats?.unmatchedReplies || 0)}
          icon={MessageSquareWarning}
          trend={stats?.unmatchedRepliesTrend != null ? -stats.unmatchedRepliesTrend : undefined}
          trendLabel="vs last month"
          colour={
            stats?.unmatchedReplies && stats.unmatchedReplies > 0
              ? 'orange'
              : 'green'
          }
          sparklineData={sparklines.unmatched}
          isLoading={isLoading}
          href="/sms-replies"
        />
        <DashboardStatsCard
          title="Active Programmes"
          value={formatNumber(stats?.activeProgrammes || 0)}
          icon={GraduationCap}
          trend={stats?.activeProgrammesTrend}
          trendLabel="vs last month"
          colour="green"
          sparklineData={sparklines.programmes}
          isLoading={isLoading}
          href="/pipelines"
        />
        <DashboardStatsCard
          title="Today's Activity"
          value={formatNumber(stats?.todayActivities || 0)}
          icon={Activity}
          trend={stats?.todayActivitiesTrend}
          trendLabel="vs yesterday"
          colour="purple"
          sparklineData={sparklines.activity}
          isLoading={isLoading}
          href="/automations"
        />
      </div>

      {/* Unmatched Replies Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <UnmatchedRepliesWidget type="sms" />
        <UnmatchedRepliesWidget type="email" />
      </div>

      {/* Follow-ups Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FollowUpsWidget type="sms" />
        <FollowUpsWidget type="email" />
      </div>

      {/* Secondary Stats: Calls Booked & Revenue */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CallsBookedCard />
        <RevenueSummaryCard />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DealsByStageChart />
        <ProgrammeInterestChart />
      </div>

      {/* Lead Sources & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LeadSourcesChart />
        <RecentActivityTimeline />
      </div>

      {/* Create Contact Modal */}
      <CreateContactModal
        isOpen={createContactOpen}
        onClose={() => setCreateContactOpen(false)}
      />
    </div>
  )
}
