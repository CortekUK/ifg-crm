import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

interface CreateDealParams {
  contactId: string
  pipelineId: string
  stageId: string
  ownerId: string
  dealValue: number
  title: string
  notes?: string
  description?: string
  winProbability?: number
  forecastedCloseDate?: string
  // Source tracking for Smart Process
  source?: 'manual' | 'smart_process' | 'automation' | 'import'
  campaignId?: string
  campaignName?: string
}

export function useCreateDeal() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      contactId,
      pipelineId,
      stageId,
      ownerId,
      dealValue,
      title,
      notes,
      description,
      winProbability,
      forecastedCloseDate,
      source,
      campaignId,
      campaignName,
    }: CreateDealParams) => {
      // Create the deal with source tracking
      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .insert({
          contact_id: contactId,
          pipeline_id: pipelineId,
          current_stage_id: stageId,
          deal_owner_id: ownerId,
          deal_value: dealValue,
          title,
          notes,
          description: description || null,
          win_probability: winProbability ?? null,
          forecasted_close_date: forecastedCloseDate || null,
          source: source || 'manual',
        })
        .select()
        .single()

      if (dealError) throw dealError

      // Build activity description based on source
      let activityDescription = `Deal created: ${title}`
      if (source === 'smart_process' && campaignName) {
        activityDescription = `Deal created from "${campaignName}" campaign reply via Smart Process`
      } else if (source === 'smart_process') {
        activityDescription = `Deal created from campaign reply via Smart Process`
      } else if (source === 'automation') {
        activityDescription = `Deal created by automation`
      } else if (source === 'import') {
        activityDescription = `Deal created from import`
      }

      // Log the activity with campaign reference if available
      const activityData: Record<string, unknown> = {
        deal_id: deal.id,
        activity_type: 'deal_created',
        description: activityDescription,
        performed_by_id: ownerId,
      }

      // Store campaign reference in metadata if available
      if (campaignId) {
        activityData.metadata = JSON.stringify({
          source,
          campaign_id: campaignId,
          campaign_name: campaignName,
        })
      }

      const { error: activityError } = await supabase
        .from('deal_activities')
        .insert(activityData)

      if (activityError) {
        console.error('Failed to log deal creation activity:', activityError)
        // Don't throw - the main operation succeeded
      }

      return deal
    },
    onSuccess: (data, variables) => {
      // Invalidate deals query to refresh the board
      queryClient.invalidateQueries({ queryKey: ['deals', variables.pipelineId] })
    },
  })
}
