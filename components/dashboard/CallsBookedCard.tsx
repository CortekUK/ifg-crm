'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Calendar, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CallsBookedCard() {
  const supabase = createClient()

  const { data, isLoading } = useQuery({
    queryKey: ['calls-booked'],
    queryFn: async () => {
      const now = new Date()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      startOfWeek.setHours(0, 0, 0, 0)

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

      // Get meeting stages (Zoom Scheduled, etc.)
      const { data: meetingStages } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('stage_type', 'meeting')

      const meetingStageIds = meetingStages?.map((s) => s.id) || []

      if (meetingStageIds.length === 0) {
        return { thisWeek: 0, thisMonth: 0, trend: 0 }
      }

      // Fetch stage_changed activities from this month onwards (covers all 3 ranges)
      const { data: activities } = await supabase
        .from('deal_activities')
        .select('created_at, new_value')
        .eq('activity_type', 'stage_changed')
        .gte('created_at', startOfLastMonth.toISOString())

      // Filter client-side for meeting stage transitions
      const meetingActivities = (activities || []).filter((a) => {
        const stageId = (a.new_value as Record<string, unknown>)?.stage_id
        return typeof stageId === 'string' && meetingStageIds.includes(stageId)
      })

      const thisWeek = meetingActivities.filter(
        (a) => new Date(a.created_at) >= startOfWeek
      ).length

      const thisMonth = meetingActivities.filter(
        (a) => new Date(a.created_at) >= startOfMonth
      ).length

      const lastMonth = meetingActivities.filter(
        (a) => {
          const d = new Date(a.created_at)
          return d >= startOfLastMonth && d <= endOfLastMonth
        }
      ).length

      const trend = lastMonth > 0
        ? Math.round((thisMonth - lastMonth) / lastMonth * 100)
        : 0

      return {
        thisWeek: thisWeek || 0,
        thisMonth: thisMonth || 0,
        trend,
      }
    },
    refetchInterval: 60000,
  })

  return (
    <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-teal-100 dark:bg-teal-900/30">
            <Calendar className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          </div>
          <CardTitle className="font-oswald text-sm font-medium text-teal-900 dark:text-teal-300 uppercase">
            Calls Booked
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-gray-900 dark:text-white tabular-nums">
                {data?.thisWeek}
              </span>
              <span className="text-sm text-muted-foreground">this week</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {data?.thisMonth} this month
              </span>
              {data?.trend !== undefined && data.trend !== 0 && (
                <div className={cn(
                  "flex items-center gap-1 text-sm font-medium",
                  data.trend > 0 ? "text-green-600" : "text-red-500"
                )}>
                  {data.trend > 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  <span>{data.trend > 0 ? '+' : ''}{data.trend}%</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
