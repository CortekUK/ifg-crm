import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { calculateDaysBetween } from '@/lib/utils/format'
import type { Deal } from '@/lib/types/pipelines'

// Helper to compute time in stage
// Uses stage_entered_at or stage_changed_at if available, otherwise falls back to created_at
function computeTimeInStage(deal: Deal): number {
  const stageDate = deal.stage_entered_at || deal.stage_changed_at || deal.created_at
  return calculateDaysBetween(stageDate)
}

export function useDeals(pipelineId: string | null) {
  const supabase = createClient()

  return useQuery<Deal[]>({
    queryKey: ['deals', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return []

      // Fetch deals with their relationships (excluding owner due to FK ambiguity)
      const { data: deals, error } = await supabase
        .from('deals')
        .select(`
          *,
          contact:contacts(id, first_name, last_name, email, phone, graduation_year),
          pipeline:pipelines(*)
        `)
        .eq('pipeline_id', pipelineId)
        .order('created_at', { ascending: false })

      if (error) {
        const errorMessage = error.message || error.details || JSON.stringify(error) || 'Unknown error'
        console.error('Error fetching deals:', errorMessage)
        throw new Error(`Failed to fetch deals: ${errorMessage}`)
      }
      if (!deals || deals.length === 0) return []

      // Fetch stages separately (using pipeline_stages - the correct table per FK constraint)
      const stageIds = [...new Set(deals.map(d => d.current_stage_id).filter(Boolean))]
      
      const { data: stagesData } = await supabase
        .from('pipeline_stages')
        .select('*')
        .in('id', stageIds)

      const stagesMap = new Map(stagesData?.map(s => [s.id, s]) || [])

      // Fetch owners separately to avoid foreign key ambiguity (deals has both deal_owner_id and owner_id)
      const ownerIds = [...new Set(deals.map(d => d.deal_owner_id).filter(Boolean))]
      const { data: ownersData } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, calendly_url')
        .in('id', ownerIds)

      const ownersMap = new Map(ownersData?.map(o => [o.id, o]) || [])

      // Build a map of deal_id -> last contacted at (non-fatal if these queries fail)
      const lastContactedMap = new Map<string, string>()
      const dealIds = deals.map((d) => d.id)

      // Fetch last email sent from automation_logs (non-fatal)
      const { data: emailLogs, error: logsError } = await supabase
        .from('automation_logs')
        .select('deal_id, sent_at')
        .eq('status', 'sent')
        .in('deal_id', dealIds)
        .order('sent_at', { ascending: false })

      if (logsError) {
        console.warn('Failed to fetch automation logs:', logsError.message)
      } else {
        emailLogs?.forEach((log) => {
          if (!lastContactedMap.has(log.deal_id)) {
            lastContactedMap.set(log.deal_id, log.sent_at)
          }
        })
      }

      // Fetch email activities (non-fatal)
      const { data: emailActivities, error: activitiesError } = await supabase
        .from('deal_activities')
        .select('deal_id, created_at')
        .eq('activity_type', 'email_sent')
        .in('deal_id', dealIds)
        .order('created_at', { ascending: false })

      if (activitiesError) {
        console.warn('Failed to fetch deal activities:', activitiesError.message)
      } else {
        emailActivities?.forEach((activity) => {
          const existing = lastContactedMap.get(activity.deal_id)
          if (!existing || new Date(activity.created_at) > new Date(existing)) {
            lastContactedMap.set(activity.deal_id, activity.created_at)
          }
        })
      }

      // Fetch active automation enrollments for these deals (non-fatal)
      const activeEnrollmentsSet = new Set<string>()
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from('automation_enrollments')
        .select('deal_id')
        .in('deal_id', dealIds)
        .eq('status', 'active')

      if (enrollmentsError) {
        console.warn('Failed to fetch automation enrollments:', enrollmentsError.message)
      } else {
        enrollments?.forEach((e) => activeEnrollmentsSet.add(e.deal_id))
      }

      // Enrich deals with computed fields, stage data, and owner
      return deals.map((deal) => ({
        ...deal,
        stage: stagesMap.get(deal.current_stage_id) || null,
        owner: ownersMap.get(deal.deal_owner_id) || null,
        time_in_stage: computeTimeInStage(deal),
        last_contacted_at: lastContactedMap.get(deal.id) || null,
        has_active_automation: activeEnrollmentsSet.has(deal.id),
      }))
    },
    enabled: !!pipelineId,
  })
}

export function useDeal(dealId: string | null) {
  const supabase = createClient()

  return useQuery<Deal | null>({
    queryKey: ['deal', dealId],
    queryFn: async () => {
      if (!dealId) return null

      const { data: deal, error } = await supabase
        .from('deals')
        .select(`
          *,
          contact:contacts(id, first_name, last_name, email, phone, graduation_year),
          pipeline:pipelines(*)
        `)
        .eq('id', dealId)
        .single()

      if (error) {
        const errorMessage = error.message || error.details || JSON.stringify(error) || 'Unknown error'
        console.error('Error fetching deal:', errorMessage)
        throw new Error(`Failed to fetch deal: ${errorMessage}`)
      }
      if (!deal) return null

      // Fetch stage separately (using pipeline_stages - the correct table per FK constraint)
      let stage = null
      if (deal.current_stage_id) {
        const { data: stageData } = await supabase
          .from('pipeline_stages')
          .select('*')
          .eq('id', deal.current_stage_id)
          .single()
        stage = stageData
      }

      // Fetch owner separately to avoid foreign key ambiguity
      let owner = null
      if (deal.deal_owner_id) {
        const { data: ownerData } = await supabase
          .from('profiles')
          .select('id, email, full_name, avatar_url, calendly_url')
          .eq('id', deal.deal_owner_id)
          .single()
        owner = ownerData
      }

      // Fetch last contacted time for this deal
      const { data: emailLogs } = await supabase
        .from('automation_logs')
        .select('sent_at')
        .eq('deal_id', dealId)
        .eq('status', 'sent')
        .order('sent_at', { ascending: false })
        .limit(1)

      const { data: emailActivities } = await supabase
        .from('deal_activities')
        .select('created_at')
        .eq('deal_id', dealId)
        .eq('activity_type', 'email_sent')
        .order('created_at', { ascending: false })
        .limit(1)

      // Determine last contacted date
      let lastContactedAt: string | null = null
      const logDate = emailLogs?.[0]?.sent_at
      const activityDate = emailActivities?.[0]?.created_at

      if (logDate && activityDate) {
        lastContactedAt = new Date(logDate) > new Date(activityDate) ? logDate : activityDate
      } else {
        lastContactedAt = logDate || activityDate || null
      }

      return {
        ...deal,
        stage,
        owner,
        time_in_stage: computeTimeInStage(deal),
        last_contacted_at: lastContactedAt,
      }
    },
    enabled: !!dealId,
  })
}

export function useMoveDeal() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      dealId,
      newStageId,
      pipelineId,
      oldStageName,
      newStageName,
      performedById,
    }: {
      dealId: string
      newStageId: string
      pipelineId: string
      oldStageName?: string
      newStageName?: string
      performedById?: string
    }) => {
      // Get current deal to find old stage if not provided
      let oldStage = oldStageName
      if (!oldStage) {
        const { data: deal } = await supabase
          .from('deals')
          .select('current_stage_id')
          .eq('id', dealId)
          .single()

        if (deal?.current_stage_id) {
          const { data: stageData } = await supabase
            .from('pipeline_stages')
            .select('name')
            .eq('id', deal.current_stage_id)
            .single()
          
          if (stageData) {
            oldStage = stageData.name
          }
        }
      }

      // Get new stage name if not provided
      let newStage = newStageName
      if (!newStage) {
        const { data: stage } = await supabase
          .from('pipeline_stages')
          .select('name')
          .eq('id', newStageId)
          .single()

        if (stage) {
          newStage = stage.name
        }
      }

      // Get current user if not provided
      let userId = performedById
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser()
        userId = user?.id
      }

      // Update the deal's stage (only current_stage_id - trigger handles stage_id sync)
      const { error: updateError } = await supabase
        .from('deals')
        .update({
          current_stage_id: newStageId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', dealId)

      if (updateError) {
        console.error('Failed to move deal:', updateError)
        throw new Error(updateError.message || 'Failed to update deal stage')
      }

      // Log the activity with stage names
      const { error: activityError } = await supabase
        .from('deal_activities')
        .insert({
          deal_id: dealId,
          activity_type: 'stage_changed',
          description: oldStage && newStage
            ? `Moved from ${oldStage} to ${newStage}`
            : 'Deal moved to new stage',
          old_value: { stage_id: dealId, stage_name: oldStage },
          new_value: { stage_id: newStageId, stage_name: newStage },
          performed_by_id: userId,
        })

      if (activityError) {
        console.error('Failed to log activity:', activityError)
        // Don't throw - the main operation succeeded
      }

      return { dealId, newStageId, newStageName: newStage }
    },
    onMutate: async ({ dealId, newStageId, pipelineId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['deals', pipelineId] })

      // Snapshot previous value
      const previousDeals = queryClient.getQueryData<Deal[]>(['deals', pipelineId])

      // Optimistically update
      queryClient.setQueryData<Deal[]>(['deals', pipelineId], (old) => {
        if (!old) return old
        return old.map((deal) =>
          deal.id === dealId ? { ...deal, current_stage_id: newStageId } : deal
        )
      })

      return { previousDeals }
    },
    onError: (err, { pipelineId }, context) => {
      // Rollback on error
      if (context?.previousDeals) {
        queryClient.setQueryData(['deals', pipelineId], context.previousDeals)
      }
    },
    onSettled: (data, error, { pipelineId, dealId }) => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ['deals', pipelineId] })
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] })
      queryClient.invalidateQueries({ queryKey: ['deal-activities', dealId] })
    },
  })
}

export function useUpdateDeal() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      dealId,
      updates,
    }: {
      dealId: string
      updates: Partial<Deal>
    }) => {
      const { error } = await supabase
        .from('deals')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', dealId)

      if (error) throw error
    },
    onSuccess: (_, { dealId }) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] })
    },
  })
}
