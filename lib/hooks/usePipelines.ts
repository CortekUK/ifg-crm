import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Pipeline } from '@/lib/types/pipelines'

export function usePipelines() {
  const supabase = createClient()

  return useQuery<Pipeline[]>({
    queryKey: ['pipelines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('*, programme:programmes(*)')
        .eq('is_active', true)
        .order('display_order')

      if (error) throw error
      return data || []
    },
  })
}

// Get deal counts per pipeline
export function usePipelineDealCounts() {
  const supabase = createClient()

  return useQuery<Record<string, number>>({
    queryKey: ['pipeline-deal-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('pipeline_id')

      if (error) throw error

      // Count deals per pipeline
      const counts: Record<string, number> = {}
      data?.forEach((deal) => {
        if (deal.pipeline_id) {
          counts[deal.pipeline_id] = (counts[deal.pipeline_id] || 0) + 1
        }
      })

      return counts
    },
  })
}
