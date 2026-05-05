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
  // Programme dates — drive the time_before_date automation trigger.
  programmeStartDate?: string
  interviewDate?: string
  arrivalDate?: string
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
      programmeStartDate,
      interviewDate,
      arrivalDate,
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
          programme_start_date: programmeStartDate || null,
          interview_date: interviewDate || null,
          arrival_date: arrivalDate || null,
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

      // Log the activity
      const { error: activityError } = await supabase
        .from('deal_activities')
        .insert({
          deal_id: deal.id,
          activity_type: 'deal_created',
          description: activityDescription,
          performed_by_id: ownerId,
        })

      if (activityError) {
        console.error('Failed to log deal creation activity:', activityError)
        // Don't throw - the main operation succeeded
      }

      // Mirror the form-webhook's enrollment behaviour for deals that land
      // here via a manual create (UI / Smart Process / API). Without this,
      // a deal_creation automation only ever counts form submissions in
      // its Enrolled column and the configured initial-contact email
      // never fires for hand-entered deals. We match by pipeline +
      // landing stage; the automation's `trigger_stage_id` is resolved
      // from `config.initial_stage_id` at save time so a single equality
      // check is enough. The first step is `create_deal`, which is a
      // no-op in the cron — the runner advances past it and the next
      // step (send_email) goes out the next tick.
      try {
        const { data: matchingAutomations } = await supabase
          .from('automations')
          .select('id, steps:automation_steps(id, step_order)')
          .eq('automation_type', 'deal_creation')
          .eq('pipeline_id', pipelineId)
          .eq('trigger_stage_id', stageId)
          .eq('is_active', true)

        for (const a of matchingAutomations ?? []) {
          const steps =
            (a.steps as { id: string; step_order: number }[] | null) ?? []
          const firstStep = [...steps].sort(
            (x, y) => x.step_order - y.step_order,
          )[0]
          if (!firstStep) continue
          const nowIso = new Date().toISOString()
          const { error: enrollError } = await supabase
            .from('automation_enrollments')
            .insert({
              automation_id: a.id,
              deal_id: deal.id,
              status: 'active',
              current_step_id: firstStep.id,
              next_step_at: nowIso,
              enrolled_at: nowIso,
            })
          if (enrollError) {
            console.error(
              'Manual deal: failed to enroll into deal_creation automation',
              { automationId: a.id, dealId: deal.id, error: enrollError },
            )
          }
        }
      } catch (e) {
        // Enrollment failure shouldn't roll back the deal create — the
        // recruiter can still work the lead, just without the email.
        console.error('Manual deal: automation enrollment lookup failed', e)
      }

      return deal
    },
    onSuccess: (data, variables) => {
      // Invalidate deals query to refresh the board
      queryClient.invalidateQueries({ queryKey: ['deals', variables.pipelineId] })
    },
  })
}
