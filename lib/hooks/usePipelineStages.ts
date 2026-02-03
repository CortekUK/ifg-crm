import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { PipelineStage } from '@/lib/types/pipelines'

export function usePipelineStages(pipelineId: string | null) {
  const supabase = createClient()

  return useQuery<PipelineStage[]>({
    queryKey: ['pipeline-stages', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return []
      
      // Query pipeline_stages table (the correct table per FK constraint)
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_id', pipelineId)
        .order('display_order')

      if (error) {
        console.error('Failed to fetch pipeline stages:', error.message)
        return []
      }
      
      return data || []
    },
    enabled: !!pipelineId,
  })
}

interface CreateStageInput {
  pipeline_id: string
  name: string
  stage_type: PipelineStage['stage_type']
  color: string
  display_order?: number
}

export function useCreateStage() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateStageInput) => {
      // If no display_order provided, get the max and add 1
      let displayOrder = input.display_order
      if (displayOrder === undefined) {
        const { data: existingStages } = await supabase
          .from('pipeline_stages')
          .select('display_order')
          .eq('pipeline_id', input.pipeline_id)
          .order('display_order', { ascending: false })
          .limit(1)

        displayOrder = (existingStages?.[0]?.display_order ?? -1) + 1
      }

      const { data, error } = await supabase
        .from('pipeline_stages')
        .insert({
          pipeline_id: input.pipeline_id,
          name: input.name,
          stage_type: input.stage_type,
          color: input.color,
          display_order: displayOrder,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages', data.pipeline_id] })
    },
  })
}

interface UpdateStageInput {
  stageId: string
  pipelineId: string
  updates: {
    name?: string
    stage_type?: PipelineStage['stage_type']
    color?: string
    display_order?: number
    triggers_automation?: boolean
    automation_id?: string | null
  }
}

export function useUpdateStage() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ stageId, updates }: UpdateStageInput) => {
      const { data, error } = await supabase
        .from('pipeline_stages')
        .update(updates)
        .eq('id', stageId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages', data.pipeline_id] })
    },
  })
}

export function useDeleteStage() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ stageId, pipelineId }: { stageId: string; pipelineId: string }) => {
      // Check if stage has any deals
      const { count, error: countError } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('current_stage_id', stageId)

      if (countError) throw countError

      if (count && count > 0) {
        throw new Error(`Cannot delete stage with ${count} active deals. Move the deals to another stage first.`)
      }

      const { error } = await supabase
        .from('pipeline_stages')
        .delete()
        .eq('id', stageId)

      if (error) throw error

      return { stageId, pipelineId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages', data.pipelineId] })
    },
  })
}

interface ReorderStagesInput {
  pipelineId: string
  stages: Array<{ id: string; display_order: number }>
}

export function useReorderStages() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ pipelineId, stages }: ReorderStagesInput) => {
      // Update each stage's display_order
      // Using Promise.all for parallel updates
      const updates = stages.map((stage) =>
        supabase
          .from('pipeline_stages')
          .update({ display_order: stage.display_order })
          .eq('id', stage.id)
          .eq('pipeline_id', pipelineId)
      )

      const results = await Promise.all(updates)

      // Check for any errors
      const errors = results.filter((r) => r.error)
      if (errors.length > 0) {
        throw new Error('Failed to reorder some stages')
      }

      return { pipelineId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages', data.pipelineId] })
    },
  })
}
