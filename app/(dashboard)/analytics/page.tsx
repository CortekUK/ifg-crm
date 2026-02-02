'use client'

import { useState } from 'react'
import { AnalyticsPageHeader } from '@/components/analytics/AnalyticsPageHeader'
import { AnalyticsKPIs } from '@/components/analytics/AnalyticsKPIs'
import { AnalyticsCharts } from '@/components/analytics/AnalyticsCharts'
import { ErrorState } from '@/components/ui/error-state'
import { useAnalytics } from '@/lib/hooks/useAnalytics'

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState('30d')

  const { data, isLoading, error, refetch, isFetching } = useAnalytics(dateRange)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <AnalyticsPageHeader
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {/* Error State */}
      {error && (
        <ErrorState
          title="Failed to load analytics"
          message="We couldn't load the analytics data. Please check your connection and try again."
          onRetry={() => refetch()}
          isRetrying={isFetching}
          compact
        />
      )}

      {/* KPI Cards */}
      <AnalyticsKPIs isLoading={isLoading} data={data?.kpis} />

      {/* Charts Grid */}
      <AnalyticsCharts
        isLoading={isLoading}
        data={data ? {
          leadsOverTime: data.leadsOverTime,
          pipelineFunnel: data.pipelineFunnel,
          revenueByMonth: data.revenueByMonth,
          leadsBySource: data.leadsBySource,
          topRecruiters: data.topRecruiters,
          programmePerformance: data.programmePerformance,
        } : undefined}
      />
    </div>
  )
}
