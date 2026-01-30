'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatNumber } from '@/lib/utils/format'
import { TrendingUp } from 'lucide-react'

interface PipelineStat {
  name: string
  deals: number
  value: number
}

export function PipelineOverviewCard() {
  const supabase = createClient()

  const { data: pipelineData, isLoading } = useQuery({
    queryKey: ['pipeline-overview'],
    queryFn: async (): Promise<PipelineStat[]> => {
      // Get all pipelines
      const { data: pipelines } = await supabase
        .from('pipelines')
        .select('id, name')
        .eq('is_active', true)

      if (!pipelines) return []

      const pipelineStats = await Promise.all(
        pipelines.map(async (pipeline) => {
          const { count } = await supabase
            .from('deals')
            .select('*', { count: 'exact', head: true })
            .eq('pipeline_id', pipeline.id)

          const { data: deals } = await supabase
            .from('deals')
            .select('deal_value')
            .eq('pipeline_id', pipeline.id)

          const totalValue =
            deals?.reduce((sum, d) => sum + (d.deal_value || 0), 0) || 0

          return {
            name: pipeline.name.replace(' 2026', '').replace(' 2025', ''),
            deals: count || 0,
            value: totalValue,
          }
        })
      )

      return pipelineStats
    },
    refetchInterval: 30000,
  })

  // Calculate max value for bar scaling
  const maxDeals = Math.max(...(pipelineData?.map((p) => p.deals) || [1]), 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline Overview</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        ) : pipelineData?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No pipeline data</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pipelineData?.map((pipeline) => (
              <div key={pipeline.name} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{pipeline.name}</span>
                  <span className="text-muted-foreground">
                    {formatNumber(pipeline.deals)} deals · {formatCurrency(pipeline.value)}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${(pipeline.deals / maxDeals) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
