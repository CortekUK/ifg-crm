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
        .order('created_at', { ascending: false })

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
  is_active?: boolean
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
          is_active: input.is_active ?? true,
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
    mutationFn: async (input: string | { pipelineId: string; force?: boolean }) => {
      // Backwards-compatible: accept either a bare pipelineId (legacy
      // call sites) or an object with a force flag.
      const pipelineId = typeof input === 'string' ? input : input.pipelineId
      const force = typeof input === 'string' ? false : !!input.force

      // Only block on deals that are still ACTIVE — won/lost deals are
      // historical records and shouldn't keep the pipeline alive forever.
      // When force=true, we wipe active deals first so the cascade on
      // `pipelines.id` handles the rest.
      const { count, error: countError } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('pipeline_id', pipelineId)
        .eq('status', 'active')

      if (countError) throw countError

      if (count && count > 0 && !force) {
        const err = new Error(
          `Cannot delete pipeline — ${count} active deal${count === 1 ? '' : 's'} still in it. ` +
          `Mark them won/lost or delete them first.`,
        ) as Error & { code?: string; activeDealCount?: number }
        err.code = 'PIPELINE_HAS_ACTIVE_DEALS'
        err.activeDealCount = count
        throw err
      }

      if (force) {
        // Hard-delete EVERY deal in this pipeline before the pipeline goes,
        // not just the active ones. Won/lost deals still reference
        // pipeline_stages.id via a NO ACTION FK (deals.current_stage_id) —
        // when the pipeline cascade-deletes its stages, that FK violation
        // rolls back the whole transaction. Wiping all deals first lets the
        // cascade work cleanly. FK cascades on deals (automation_enrollments,
        // deal_activities, invoices, etc.) clean up their dependents.
        const { error: dealsDeleteError } = await supabase
          .from('deals')
          .delete()
          .eq('pipeline_id', pipelineId)
        if (dealsDeleteError) {
          console.error('Force-delete: failed to wipe deals', dealsDeleteError)
          throw new Error(`Failed to delete deals: ${dealsDeleteError.message}`)
        }
      }

      // The DB schema *should* SET NULL on automations.pipeline_id and
      // campaigns.pipeline_id when a pipeline is deleted, but in practice the
      // automations FK has been seen to violate (e.g. constraint dropped/
      // recreated without SET NULL). Null these references out explicitly
      // before deleting the pipeline so the cascade can complete cleanly.
      const [automationsNullErr, campaignsNullErr] = await Promise.all([
        supabase
          .from('automations')
          .update({ pipeline_id: null })
          .eq('pipeline_id', pipelineId)
          .then((r) => r.error),
        supabase
          .from('campaigns')
          .update({ pipeline_id: null })
          .eq('pipeline_id', pipelineId)
          .then((r) => r.error),
      ])
      if (automationsNullErr) {
        console.error('Failed to null automations.pipeline_id', automationsNullErr)
        throw new Error(
          `Failed to detach automations from pipeline: ${automationsNullErr.message}`
        )
      }
      if (campaignsNullErr) {
        console.error('Failed to null campaigns.pipeline_id', campaignsNullErr)
        throw new Error(
          `Failed to detach campaigns from pipeline: ${campaignsNullErr.message}`
        )
      }

      // Delete pipeline (stages, deals, and their FK children cascade-delete
      // via the existing constraints).
      const { error } = await supabase
        .from('pipelines')
        .delete()
        .eq('id', pipelineId)

      if (error) {
        console.error('Pipeline delete failed', error)
        throw new Error(error.message || 'Pipeline delete failed')
      }
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

// Get campaigns linked to a pipeline
interface PipelineCampaignStats {
  id: string
  name: string
  type: 'email' | 'sms'
  status: string
  sent_at: string | null
  created_at: string
  total_recipients?: number
  // Stats from email_sends
  reply_count?: number
  deal_count?: number
}

export function usePipelineCampaigns(pipelineId: string | null) {
  const supabase = createClient()

  return useQuery<PipelineCampaignStats[]>({
    queryKey: ['pipeline-campaigns', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return []

      // Get campaigns linked to this pipeline
      const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('id, name, type, status, sent_at, created_at, total_recipients')
        .eq('pipeline_id', pipelineId)
        .order('created_at', { ascending: false })

      if (error) throw error
      if (!campaigns || campaigns.length === 0) return []

      // Get reply counts from email_replies for each campaign
      const campaignIds = campaigns.map(c => c.id)

      const { data: replyCounts } = await supabase
        .from('email_replies')
        .select('campaign_id')
        .in('campaign_id', campaignIds)

      const replyCountMap = new Map<string, number>()
      replyCounts?.forEach(r => {
        if (r.campaign_id) {
          replyCountMap.set(r.campaign_id, (replyCountMap.get(r.campaign_id) || 0) + 1)
        }
      })

      // Get deal counts created from Smart Process for this pipeline
      const { data: deals } = await supabase
        .from('deals')
        .select('id, source')
        .eq('pipeline_id', pipelineId)
        .eq('source', 'smart_process')

      const dealCount = deals?.length || 0

      return campaigns.map(campaign => ({
        ...campaign,
        reply_count: replyCountMap.get(campaign.id) || 0,
        deal_count: campaign.status === 'sent' ? Math.round(dealCount / campaigns.filter(c => c.status === 'sent').length) : 0,
      }))
    },
    enabled: !!pipelineId,
  })
}
