import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { PipelineStage } from '@/lib/types/pipelines'

export function usePipelineStages(pipelineId: string | null) {
  const supabase = createClient()

  return useQuery<PipelineStage[]>({
    queryKey: ['pipeline-stages', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return []
      
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_id', pipelineId)
        .order('display_order')

      if (error) throw error
      return data || []
    },
    enabled: !!pipelineId,
  })
}
