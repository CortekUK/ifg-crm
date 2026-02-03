import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Pipeline, PipelineStage } from '@/lib/types/pipelines'

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

export function useAllPipelines() {
  const supabase = createClient()

  return useQuery<Pipeline[]>({
    queryKey: ['all-pipelines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('*, programme:programmes(*)')
        .order('display_order')

      if (error) throw error
      return data || []
    },
  })
}

interface CreatePipelineInput {
  name: string
  sport: 'football' | 'basketball'
  programme_id?: string | null
  stages?: Array<{
    name: string
    stage_type: PipelineStage['stage_type']
    color: string
    display_order: number
  }>
}

export function useCreatePipeline() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreatePipelineInput) => {
      // Get the max display_order for the new pipeline
      const { data: existingPipelines } = await supabase
        .from('pipelines')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1)

      const maxOrder = existingPipelines?.[0]?.display_order ?? -1

      // Create the pipeline
      const { data: pipeline, error: pipelineError } = await supabase
        .from('pipelines')
        .insert({
          name: input.name,
          sport: input.sport,
          programme_id: input.programme_id || null,
          display_order: maxOrder + 1,
          is_active: true,
        })
        .select()
        .single()

      if (pipelineError) throw pipelineError

      // Create default stages if provided
      if (input.stages && input.stages.length > 0) {
        const stagesToInsert = input.stages.map((stage) => ({
          pipeline_id: pipeline.id,
          name: stage.name,
          stage_type: stage.stage_type,
          color: stage.color,
          display_order: stage.display_order,
        }))

        const { error: stagesError } = await supabase
          .from('pipeline_stages')
          .insert(stagesToInsert)

        if (stagesError) throw stagesError
      }

      return pipeline
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      queryClient.invalidateQueries({ queryKey: ['all-pipelines'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline-deal-counts'] })
    },
  })
}

interface UpdatePipelineInput {
  pipelineId: string
  updates: {
    name?: string
    sport?: 'football' | 'basketball'
    programme_id?: string | null
    is_active?: boolean
    display_order?: number
  }
}

export function useUpdatePipeline() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ pipelineId, updates }: UpdatePipelineInput) => {
      const { data, error } = await supabase
        .from('pipelines')
        .update(updates)
        .eq('id', pipelineId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      queryClient.invalidateQueries({ queryKey: ['all-pipelines'] })
    },
  })
}

export function useDeletePipeline() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (pipelineId: string) => {
      // Check if pipeline has any deals
      const { count, error: countError } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('pipeline_id', pipelineId)

      if (countError) throw countError

      if (count && count > 0) {
        throw new Error(`Cannot delete pipeline with ${count} active deals. Move or delete the deals first.`)
      }

      // Delete pipeline (stages will cascade delete due to FK constraint)
      const { error } = await supabase
        .from('pipelines')
        .delete()
        .eq('id', pipelineId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      queryClient.invalidateQueries({ queryKey: ['all-pipelines'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline-deal-counts'] })
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
