'use client'

import { useState } from 'react'
import { AnalyticsPageHeader } from '@/components/analytics/AnalyticsPageHeader'
import { AnalyticsKPIs } from '@/components/analytics/AnalyticsKPIs'
import { AnalyticsCharts } from '@/components/analytics/AnalyticsCharts'

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState('30d')

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <AnalyticsPageHeader
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {/* KPI Cards */}
      <AnalyticsKPIs />

      {/* Charts Grid */}
      <AnalyticsCharts />
    </div>
  )
}
