'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatNumber } from '@/lib/utils/format'
import { PieChart } from 'lucide-react'

const programmeColours = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#6b7280', // Grey
]

interface ProgrammeData {
  name: string
  count: number
  percentage: number
  colour: string
}

export function ProgrammeInterestChart() {
  const supabase = createClient()

  const { data, isLoading } = useQuery({
    queryKey: ['programme-interest'],
    queryFn: async () => {
      // Get programmes and count deals for each
      const { data: programmes } = await supabase
        .from('programmes')
        .select('id, name')
        .eq('is_active', true)

      if (!programmes) return { programmes: [], total: 0 }

      // Get pipelines linked to programmes and count deals
      const programmeStats = await Promise.all(
        programmes.map(async (programme, index) => {
          const { data: pipelines } = await supabase
            .from('pipelines')
            .select('id')
            .eq('programme_id', programme.id)

          const pipelineIds = pipelines?.map((p) => p.id) || []

          let count = 0
          if (pipelineIds.length > 0) {
            const { count: dealCount } = await supabase
              .from('deals')
              .select('*', { count: 'exact', head: true })
              .in('pipeline_id', pipelineIds)
            count = dealCount || 0
          }

          return {
            name: programme.name.replace(' Programme', '').replace(' 2026', '').replace(' 2025', ''),
            count,
            colour: programmeColours[index % programmeColours.length],
          }
        })
      )

      const total = programmeStats.reduce((sum, p) => sum + p.count, 0)

      const programmeData: ProgrammeData[] = programmeStats
        .map((p) => ({
          ...p,
          percentage: total > 0 ? Math.round((p.count / total) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count)

      return { programmes: programmeData, total }
    },
    refetchInterval: 60000,
  })

  // Calculate circumference for donut chart
  const radius = 60
  const circumference = 2 * Math.PI * radius

  return (
    <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
            <PieChart className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <CardTitle className="font-oswald text-sm font-medium text-blue-900 dark:text-blue-300 uppercase">
            PROGRAMME INTEREST
          </CardTitle>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Distribution of player interest across programmes
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-40 w-40 rounded-full" />
            <div className="flex flex-wrap gap-2 justify-center">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-6 w-24" />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {/* Donut Chart */}
            <div className="relative">
              <svg width="160" height="160" viewBox="0 0 160 160">
                {/* Background circle */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke="#f1f5f9"
                  strokeWidth="16"
                />
                {/* Segments */}
                {data?.programmes.reduce(
                  (acc, programme, index) => {
                    const segmentLength = (programme.percentage / 100) * circumference
                    const element = (
                      <circle
                        key={programme.name}
                        cx="80"
                        cy="80"
                        r={radius}
                        fill="none"
                        stroke={programme.colour}
                        strokeWidth="16"
                        strokeDasharray={`${segmentLength} ${circumference}`}
                        strokeDashoffset={-acc.offset}
                        transform="rotate(-90 80 80)"
                        className="transition-all duration-500"
                      />
                    )
                    return {
                      elements: [...acc.elements, element],
                      offset: acc.offset + segmentLength,
                    }
                  },
                  { elements: [] as React.ReactElement[], offset: 0 }
                ).elements}
              </svg>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  {formatNumber(data?.total || 0)}
                </span>
                <span className="text-xs text-muted-foreground">Total Leads</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center">
              {data?.programmes.slice(0, 5).map((programme) => (
                <div key={programme.name} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: programme.colour }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {programme.name} ({programme.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
