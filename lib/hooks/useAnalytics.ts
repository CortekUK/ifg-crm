import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

/**
 * Analytics, from one SQL function.
 *
 * The previous version made ~25 round trips per load, three of them N+1
 * loops, and summed money in the browser from responses PostgREST caps at
 * 1000 rows. `analytics_overview()` does the counting in the database.
 */

export interface AnalyticsKpis {
  leads: number
  leads_previous: number
  deals: number
  deals_previous: number
  deals_won: number
  deals_won_previous: number
  deals_lost: number
  revenue: number
  revenue_previous: number
  won_value: number
  open_value: number
  outstanding: number
  unmatched_replies: number
}

export interface AnalyticsData {
  generated_at: string
  kpis: AnalyticsKpis
  email: {
    sent: number
    failed: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    /** Sends with any delivery event. Zero means tracking isn't reporting yet. */
    tracked: number
    replies: number
  }
  leads_over_time: { date: string; leads: number }[]
  funnel: { stage: string; type: string | null; count: number }[]
  stage_conversion: { stage: string; entered: number; advanced: number; rate: number }[]
  time_in_stage: { stage: string; avg_days: number; samples: number }[]
  revenue_by_month: { month: string; revenue: number }[]
  lead_sources: { name: string; value: number }[]
  recruiters: { name: string; deals: number; won: number; value: number }[]
  programmes: { programme: string; deals: number; won: number; value: number }[]
  automation: {
    active: number
    enrolled: number
    sent: number
    failed: number
    skipped: number
  }
}

export function getDateRange(range: string) {
  const end = new Date()
  const start = new Date()

  switch (range) {
    case '7d':
      start.setDate(end.getDate() - 7)
      break
    case '90d':
      start.setDate(end.getDate() - 90)
      break
    case 'year':
      start.setMonth(0, 1)
      start.setHours(0, 0, 0, 0)
      break
    case '30d':
    default:
      start.setDate(end.getDate() - 30)
  }

  // The comparison window is the same length, immediately before this one.
  const length = end.getTime() - start.getTime()
  const previousEnd = new Date(start.getTime() - 1)
  const previousStart = new Date(previousEnd.getTime() - length)

  return { start, end, previousStart, previousEnd }
}

/**
 * Percentage change, or null when there is no baseline to compare against.
 *
 * Returning null rather than "+100%" matters: the first month of a metric
 * is not a hundred-percent improvement on anything, and a card that says
 * so is inventing a trend.
 */
export function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

export function useAnalytics(dateRange: string = '30d', pipelineId: string | null = null) {
  const supabase = createClient()

  return useQuery<AnalyticsData>({
    queryKey: ['analytics', dateRange, pipelineId],
    queryFn: async () => {
      const { start, end, previousStart, previousEnd } = getDateRange(dateRange)

      const { data, error } = await supabase.rpc('analytics_overview', {
        p_start: start.toISOString(),
        p_end: end.toISOString(),
        p_prev_start: previousStart.toISOString(),
        p_prev_end: previousEnd.toISOString(),
        p_pipeline_id: pipelineId,
      })

      if (error) throw error
      return data as AnalyticsData
    },
    staleTime: 60_000,
  })
}
