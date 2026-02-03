import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { PipelineStage } from '@/lib/types/pipelines'

export function usePipelineStages(pipelineId: string | null) {
  const supabase = createClient()

  return useQuery<PipelineStage[]>({
    queryKey: ['pipeline-stages', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return []
      
      // Try pipeline_stages table (per migration schema)
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_id', pipelineId)
        .order('display_order')

      if (error) {
        console.warn('Failed to fetch pipeline stages:', error.message)
        return []
      }
      return data || []
    },
    enabled: !!pipelineId,
  })
}
