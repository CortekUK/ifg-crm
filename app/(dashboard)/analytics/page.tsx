'use client'

import { useState } from 'react'
import { AnalyticsPageHeader } from '@/components/analytics/AnalyticsPageHeader'
import { AnalyticsKPIs } from '@/components/analytics/AnalyticsKPIs'
import { AnalyticsCharts } from '@/components/analytics/AnalyticsCharts'
import { StagePerformance } from '@/components/analytics/StagePerformance'
import { AnalyticsBreakdown } from '@/components/analytics/AnalyticsBreakdown'
import { ErrorState } from '@/components/ui/error-state'
import { useAnalytics } from '@/lib/hooks/useAnalytics'

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState('30d')
  const [pipelineId, setPipelineId] = useState<string | null>(null)

  const { data, isLoading, error, refetch, isFetching } = useAnalytics(dateRange, pipelineId)

  return (
    <div className="space-y-4">
      <AnalyticsPageHeader
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        pipelineId={pipelineId}
        onPipelineChange={setPipelineId}
      />

      {error && (
        <ErrorState
          title="Failed to load analytics"
          message="We couldn't load the analytics data. Please check your connection and try again."
          onRetry={() => refetch()}
          isRetrying={isFetching}
          compact
        />
      )}

      <AnalyticsKPIs isLoading={isLoading} data={data} />
      <AnalyticsCharts isLoading={isLoading} data={data} />
      <StagePerformance isLoading={isLoading} data={data} />
      <AnalyticsBreakdown isLoading={isLoading} data={data} />
    </div>
  )
}
