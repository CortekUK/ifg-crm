import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface ResettableEnrollment {
  id: string
  automation_id: string
  automation_name: string
  status: 'active' | 'paused' | 'stopped' | 'completed'
  enrolled_at: string
}

/**
 * Check if a deal has resettable enrollments for automations that trigger on a specific stage
 */
export function useResettableEnrollments(dealId: string | null, targetStageId: string | null) {
  const supabase = createClient()

  return useQuery<ResettableEnrollment[]>({
    queryKey: ['resettable-enrollments', dealId, targetStageId],
    queryFn: async () => {
      if (!dealId || !targetStageId) return []

      // First, find automations that trigger on this stage
      const { data: automations, error: automationsError } = await supabase
        .from('automations')
        .select('id, name')
        .eq('trigger_stage_id', targetStageId)
        .eq('is_active', true)

      if (automationsError || !automations || automations.length === 0) {
        return []
      }

      const automationIds = automations.map(a => a.id)
      const automationMap = new Map(automations.map(a => [a.id, a.name]))

      // Find enrollments for this deal that are stopped or completed
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from('automation_enrollments')
        .select('id, automation_id, status, enrolled_at')
        .eq('deal_id', dealId)
        .in('automation_id', automationIds)
        .in('status', ['stopped', 'completed'])

      if (enrollmentsError || !enrollments) {
        return []
      }

      return enrollments.map(e => ({
        id: e.id,
        automation_id: e.automation_id,
        automation_name: automationMap.get(e.automation_id) || 'Unknown Automation',
        status: e.status as 'stopped' | 'completed',
        enrolled_at: e.enrolled_at,
      }))
    },
    enabled: !!dealId && !!targetStageId,
  })
}

/**
 * Reset automation enrollments to allow re-triggering
 */
export function useResetEnrollments() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (enrollmentIds: string[]) => {
      if (enrollmentIds.length === 0) return

      // Update enrollments to 'stopped' with a specific reason that the trigger recognizes
      // The database trigger will then re-enroll when the deal moves to the trigger stage
      const { error } = await supabase
        .from('automation_enrollments')
        .update({
          status: 'stopped',
          stopped_reason: 'Reset for re-enrollment',
        })
        .in('id', enrollmentIds)

      if (error) {
        throw new Error(`Failed to reset enrollments: ${error.message}`)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resettable-enrollments'] })
      queryClient.invalidateQueries({ queryKey: ['automation_enrollments'] })
      queryClient.invalidateQueries({ queryKey: ['deal-automations'] })
      queryClient.invalidateQueries({ queryKey: ['contact-automations'] })
    },
  })
}

/**
 * Check if a stage has any active automations that trigger on it
 */
export function useStageHasAutomation(stageId: string | null, pipelineId: string | null) {
  const supabase = createClient()

  return useQuery<boolean>({
    queryKey: ['stage-has-automation', stageId, pipelineId],
    queryFn: async () => {
      if (!stageId || !pipelineId) return false

      const { data, error } = await supabase
        .from('automations')
        .select('id')
        .eq('trigger_stage_id', stageId)
        .eq('pipeline_id', pipelineId)
        .eq('is_active', true)
        .limit(1)

      if (error) return false
      return data && data.length > 0
    },
    enabled: !!stageId && !!pipelineId,
  })
}
