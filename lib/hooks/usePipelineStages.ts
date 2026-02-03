import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { PipelineStage } from '@/lib/types/pipelines'

export function usePipelineStages(pipelineId: string | null) {
  const supabase = createClient()

  return useQuery<PipelineStage[]>({
    queryKey: ['pipeline-stages', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return []
      
      // Try pipeline_stages table first (per migration schema)
      const { data: pipelineStagesData, error: psError } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_id', pipelineId)
        .order('display_order')

      if (!psError && pipelineStagesData && pipelineStagesData.length > 0) {
        return pipelineStagesData
      }

      // Fallback to stages table if pipeline_stages is empty or errored
      const { data: stagesData, error: sError } = await supabase
        .from('stages')
        .select('*')
        .eq('pipeline_id', pipelineId)
        .order('display_order')

      if (sError) {
        console.warn('Failed to fetch stages:', sError.message)
        return pipelineStagesData || [] // Return whatever we got from pipeline_stages
      }
      
      return stagesData || pipelineStagesData || []
    },
    enabled: !!pipelineId,
  })
}
