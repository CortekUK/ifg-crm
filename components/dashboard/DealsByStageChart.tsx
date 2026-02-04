'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { GitBranch } from 'lucide-react'

interface StageData {
  name: string
  count: number
  colour: string
}

export function DealsByStageChart() {
  const supabase = createClient()

  const { data, isLoading } = useQuery({
    queryKey: ['deals-by-stage'],
    queryFn: async () => {
      // Get all pipeline stages with deal counts
      const { data: stages, error: stagesError } = await supabase
        .from('pipeline_stages')
        .select(`
          id,
          name,
          color,
          display_order,
          deals:deals(count)
        `)
        .order('display_order', { ascending: true })

      if (stagesError) throw stagesError

      // Aggregate deals across all pipelines by stage name
      const stageMap = new Map<string, { count: number; colour: string; order: number }>()

      stages?.forEach((stage) => {
        const existing = stageMap.get(stage.name)
        const dealCount = (stage.deals as unknown as { count: number }[])?.[0]?.count || 0

        if (existing) {
          existing.count += dealCount
        } else {
          stageMap.set(stage.name, {
            count: dealCount,
            colour: stage.color || '#3b82f6',
            order: stage.display_order,
          })
        }
      })

      // Convert to array and sort by typical pipeline order
      const stageData: StageData[] = Array.from(stageMap.entries())
        .map(([name, data]) => ({
          name,
          count: data.count,
          colour: data.colour,
        }))
        .filter((s) => s.count > 0) // Only show stages with deals
        .slice(0, 6) // Top 6 stages

      const total = stageData.reduce((sum, s) => sum + s.count, 0)

      return { stages: stageData, total }
    },
    refetchInterval: 30000,
  })

  const maxCount = data?.stages?.[0]?.count || 1

  return (
    <Card className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-slate-50 dark:from-slate-800/50 to-transparent pointer-events-none" />

      <CardHeader className="relative z-10 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
            <GitBranch className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <CardTitle className="font-oswald text-sm font-medium text-purple-900 dark:text-purple-300 uppercase">
            Deals by Stage
          </CardTitle>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Current pipeline distribution
        </p>
      </CardHeader>
      <CardContent className="relative z-10 pt-0">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : data?.stages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 inline-block mb-2">
              <GitBranch className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm">No deals in pipeline</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data?.stages.map((stage) => (
              <div key={stage.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: stage.colour }}
                    />
                    <span className="font-medium text-gray-900 dark:text-white">
                      {stage.name}
                    </span>
                  </div>
                  <span className="text-muted-foreground tabular-nums">
                    {stage.count}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(stage.count / maxCount) * 100}%`,
                      backgroundColor: stage.colour,
                    }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-900 dark:text-white">Total Deals</span>
                <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                  {data?.total}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
