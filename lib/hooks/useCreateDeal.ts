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
    }: CreateDealParams) => {
      // Create the deal
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
        })
        .select()
        .single()

      if (dealError) throw dealError

      // Log the activity
      const { error: activityError } = await supabase
        .from('deal_activities')
        .insert({
          deal_id: deal.id,
          activity_type: 'deal_created',
          description: `Deal created: ${title}`,
          performed_by_id: ownerId,
        })

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
