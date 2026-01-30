'use client'

import { useState } from 'react'
import { useDashboardStats } from '@/lib/hooks/useDashboardStats'
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner'
import { DashboardStatsCard } from '@/components/dashboard/DashboardStatsCard'
import { UnmatchedRepliesWidget } from '@/components/dashboard/UnmatchedRepliesWidget'
import { FollowUpsWidget } from '@/components/dashboard/FollowUpsWidget'
import { LeadSourcesChart } from '@/components/dashboard/LeadSourcesChart'
import { ProgrammeInterestChart } from '@/components/dashboard/ProgrammeInterestChart'
import { RecentActivityTimeline } from '@/components/dashboard/RecentActivityTimeline'
import { CreateContactModal } from '@/components/contacts/CreateContactModal'
import { formatNumber } from '@/lib/utils/format'
import {
  Users,
  MessageSquareWarning,
  GraduationCap,
  Activity,
} from 'lucide-react'

// Generate random sparkline data
const generateSparklineData = (length = 12) => {
  return Array.from({ length }, () => Math.floor(Math.random() * 10) + 2)
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats()
  const [createContactOpen, setCreateContactOpen] = useState(false)

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <WelcomeBanner onNewLead={() => setCreateContactOpen(true)} />

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardStatsCard
          title="Total Leads"
          value={isLoading ? '...' : formatNumber(stats?.totalContacts || 0)}
          icon={Users}
          trend={12}
          trendLabel="vs last month"
          colour="blue"
          sparklineData={generateSparklineData()}
          isLoading={isLoading}
        />
        <DashboardStatsCard
          title="Unmatched Replies"
          value={isLoading ? '...' : formatNumber(stats?.unmatchedReplies || 0)}
          icon={MessageSquareWarning}
          trend={stats?.unmatchedReplies && stats.unmatchedReplies > 0 ? -5 : 0}
          trendLabel="vs last month"
          colour={
            stats?.unmatchedReplies && stats.unmatchedReplies > 0
              ? 'orange'
              : 'green'
          }
          sparklineData={generateSparklineData()}
          isLoading={isLoading}
        />
        <DashboardStatsCard
          title="Active Programmes"
          value={isLoading ? '...' : formatNumber(stats?.activeProgrammes || 0)}
          icon={GraduationCap}
          trend={2}
          trendLabel="vs last month"
          colour="green"
          sparklineData={generateSparklineData()}
          isLoading={isLoading}
        />
        <DashboardStatsCard
          title="Today's Activity"
          value={isLoading ? '...' : formatNumber(stats?.todayActivities || 0)}
          icon={Activity}
          trend={8}
          trendLabel="vs yesterday"
          colour="purple"
          sparklineData={generateSparklineData()}
          isLoading={isLoading}
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

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LeadSourcesChart />
        <ProgrammeInterestChart />
      </div>

      {/* Recent Activity Timeline */}
      <RecentActivityTimeline />

      {/* Create Contact Modal */}
      <CreateContactModal
        isOpen={createContactOpen}
        onClose={() => setCreateContactOpen(false)}
      />
    </div>
  )
}
