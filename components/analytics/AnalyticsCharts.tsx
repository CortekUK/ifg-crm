'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
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

// Fallback data for when there's no data
const defaultLeadsOverTime = [
  { date: '01/01', leads: 0 },
]

const defaultPipelineFunnel = [
  { stage: 'No data', count: 0 },
]

const defaultRevenueByMonth = [
  { month: 'N/A', revenue: 0 },
]

const defaultLeadsBySource = [
  { name: 'No data', value: 0, color: '#E5E7EB' },
]

const defaultTopRecruiters = [
  { name: 'No data', deals: 0 },
]

const defaultProgrammePerformance = [
  { programme: 'No data', enrolments: 0 },
]

const defaultStageConversionRates = [
  { fromStage: 'Stage 1', toStage: 'Stage 2', rate: 0 },
]

const defaultAvgTimePerStage = [
  { stage: 'No data', avgDays: 0 },
]

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function AnalyticsCharts({ isLoading, data }: AnalyticsChartsProps) {
  // Wait for client-side mount to avoid ResponsiveContainer SSR dimension issues
  const [isMounted, setIsMounted] = useState(false)
  
  useEffect(() => {
    setIsMounted(true)
  }, [])

  const leadsOverTime = data?.leadsOverTime?.length ? data.leadsOverTime : defaultLeadsOverTime
  const pipelineFunnel = data?.pipelineFunnel?.length ? data.pipelineFunnel : defaultPipelineFunnel
  const stageConversionRates = data?.stageConversionRates?.length ? data.stageConversionRates : defaultStageConversionRates
  const avgTimePerStage = data?.avgTimePerStage?.length ? data.avgTimePerStage : defaultAvgTimePerStage
  const revenueByMonth = data?.revenueByMonth?.length ? data.revenueByMonth : defaultRevenueByMonth
  const leadsBySource = data?.leadsBySource?.length ? data.leadsBySource : defaultLeadsBySource
  const topRecruiters = data?.topRecruiters?.length ? data.topRecruiters : defaultTopRecruiters
  const programmePerformance = data?.programmePerformance?.length ? data.programmePerformance : defaultProgrammePerformance

  // Transform stage conversion rates for display
  const conversionRatesForChart = stageConversionRates.map(item => ({
    transition: `${item.fromStage} → ${item.toStage}`,
    rate: item.rate,
  }))

  if (isLoading || !isMounted) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Leads Over Time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={leadsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  stroke="#9CA3AF"
                />
                <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="leads"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineFunnel} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                <YAxis
                  dataKey="stage"
                  type="category"
                  tick={{ fontSize: 11 }}
                  stroke="#9CA3AF"
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Stage Conversion Rates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stage Conversion Rates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {conversionRatesForChart.length > 0 && conversionRatesForChart[0].rate > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conversionRatesForChart} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12 }}
                    stroke="#9CA3AF"
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <YAxis
                    dataKey="transition"
                    type="category"
                    tick={{ fontSize: 10 }}
                    stroke="#9CA3AF"
                    width={120}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                    }}
                    formatter={(value) => [`${value}%`, 'Conversion Rate']}
                  />
                  <Bar dataKey="rate" fill="#10B981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                No stage transition data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Average Time Per Stage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Average Time Per Stage (Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {avgTimePerStage.length > 0 && avgTimePerStage[0].avgDays > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={avgTimePerStage}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    dataKey="stage"
                    tick={{ fontSize: 10 }}
                    stroke="#9CA3AF"
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="#9CA3AF"
                    tickFormatter={(value) => `${value}d`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                    }}
                    formatter={(value) => [`${value} days`, 'Avg Time']}
                  />
                  <Bar dataKey="avgDays" fill="#6366F1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                No stage timing data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Revenue by Month */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue by Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  stroke="#9CA3AF"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#9CA3AF"
                  tickFormatter={(value) => `£${value / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => [formatCurrency(value as number), 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Leads by Source */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads by Source</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={leadsBySource}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {leadsBySource.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                  }}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  wrapperStyle={{ fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top Recruiters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Recruiters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topRecruiters} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 11 }}
                  stroke="#9CA3AF"
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="deals" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Programme Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Programme Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={programmePerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="programme"
                  tick={{ fontSize: 10 }}
                  stroke="#9CA3AF"
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="enrolments" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
