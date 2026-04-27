import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Automation, AutomationLog, AutomationFilters, AutomationEnrollment, AutomationType, AutomationConfig } from '@/lib/types/automations'
import { compileAutomationSteps, type CompiledStep } from '@/lib/automations/compile'

export interface CreateAutomationInput {
  name: string
  description?: string | null
  automation_type?: AutomationType
  trigger_type?: 'form_submission' | 'enters_stage' | 'stage_change'
  pipeline_id: string | null
  trigger_stage_id: string | null
  stop_on_stage_ids?: string[]
  config?: AutomationConfig | null
}

export interface UpdateAutomationInput extends CreateAutomationInput {
  id: string
}

export function useAutomations() {
  const supabase = createClient()

  return useQuery<Automation[]>({
    queryKey: ['automations'],
    queryFn: async () => {
      // First, fetch automations with pipeline and steps
      const { data, error } = await supabase
        .from('automations')
        .select(`
          *,
          pipeline:pipelines(*),
          steps:automation_steps(*, template:email_templates(*))
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching automations:', error)
        throw error
      }

      if (!data || data.length === 0) {
        return []
      }

      // Fetch trigger stages and enrollment counts in parallel
      const triggerStageIds = data
        .map((a) => a.trigger_stage_id)
        .filter((id): id is string => !!id)
      const automationIds = data.map((a) => a.id)

      const [{ data: enrollmentCounts }, stagesResult] = await Promise.all([
        supabase
          .from('automation_enrollments')
          .select('automation_id')
          .in('automation_id', automationIds)
          .eq('status', 'active'),
        triggerStageIds.length > 0
          ? supabase.from('pipeline_stages').select('id, name').in('id', triggerStageIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      ])

      // Count enrollments per automation
      const enrollmentCountMap = new Map<string, number>()
      enrollmentCounts?.forEach((e) => {
        const count = enrollmentCountMap.get(e.automation_id) || 0
        enrollmentCountMap.set(e.automation_id, count + 1)
      })

      const stageMap = new Map(stagesResult.data?.map((s) => [s.id, s]) || [])

      return data.map((automation) => ({
        ...automation,
        trigger_stage: automation.trigger_stage_id 
          ? stageMap.get(automation.trigger_stage_id) || null 
          : null,
        total_enrolled: enrollmentCountMap.get(automation.id) || 0,
      }))
    },
  })
}

export function useAutomation(automationId: string | null) {
  const supabase = createClient()

  return useQuery<Automation | null>({
    queryKey: ['automation', automationId],
    queryFn: async () => {
      if (!automationId) return null

      const { data, error } = await supabase
        .from('automations')
        .select(`
          *,
          pipeline:pipelines(*),
          steps:automation_steps(*, template:email_templates(*))
        `)
        .eq('id', automationId)
        .single()

      if (error) {
        console.error('Error fetching automation:', error)
        throw error
      }

      // Fetch trigger stage separately
      let triggerStage = null
      if (data.trigger_stage_id) {
        const { data: stage } = await supabase
          .from('pipeline_stages')
          .select('*')
          .eq('id', data.trigger_stage_id)
          .single()
        triggerStage = stage || null
      }

      return {
        ...data,
        trigger_stage: triggerStage,
      }
    },
    enabled: !!automationId,
  })
}

export function useAutomationEnrollments(automationId: string | null) {
  const supabase = createClient()

  return useQuery<AutomationEnrollment[]>({
    queryKey: ['automation-enrollments', automationId],
    queryFn: async () => {
      if (!automationId) return []

      const { data, error } = await supabase
        .from('automation_enrollments')
        .select(`
          *,
          deal:deals(
            id,
            title,
            contact:contacts(id, first_name, last_name, email)
          )
        `)
        .eq('automation_id', automationId)
        .order('enrolled_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: !!automationId,
  })
}

export function useAutomationLogs(filters?: AutomationFilters) {
  const supabase = createClient()

  return useQuery<AutomationLog[]>({
    queryKey: ['automation-logs', filters],
    queryFn: async () => {
      let query = supabase
        .from('automation_logs')
        .select(`
          *,
          step:automation_steps(*, automation:automations(*)),
          deal:deals(
            id,
            title,
            contact:contacts(id, first_name, last_name, email)
          )
        `)
        .order('sent_at', { ascending: false })
        .limit(100)

      // Apply filters
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    },
  })
}

export function useToggleAutomation() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ automationId, isActive }: { automationId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('automations')
        .update({ is_active: isActive })
        .eq('id', automationId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] })
    },
  })
}

export function useAutomationStats(automationId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['automation-stats', automationId],
    queryFn: async () => {
      if (!automationId) return null

      const [
        { count: enrolledCount },
        { count: completedCount },
        { count: sentCount },
      ] = await Promise.all([
        supabase
          .from('automation_enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('automation_id', automationId)
          .eq('status', 'active'),
        supabase
          .from('automation_enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('automation_id', automationId)
          .eq('status', 'completed'),
        supabase
          .from('automation_logs')
          .select('*, step:automation_steps!inner(automation_id)', { count: 'exact', head: true })
          .eq('step.automation_id', automationId)
          .eq('status', 'sent'),
      ])

      return {
        enrolled: enrolledCount || 0,
        completed: completedCount || 0,
        totalSent: sentCount || 0,
      }
    },
    enabled: !!automationId,
  })
}

// Stamp a compiled-step list with the automation_id and sequential step_order.
// All shape logic lives in lib/automations/compile.ts; this hook only wires
// the resulting rows to the DB.
function buildAutomationSteps(
  automationId: string,
  automationType: AutomationType | undefined,
  config: AutomationConfig | null | undefined,
): Array<CompiledStep & { automation_id: string; step_order: number }> {
  return compileAutomationSteps(automationType, config).map((step, index) => ({
    ...step,
    automation_id: automationId,
    step_order: index + 1,
  }))
}

export function useCreateAutomation() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateAutomationInput) => {
      // Insert the automation (paused by default)
      const { data: automation, error: automationError } = await supabase
        .from('automations')
        .insert({
          name: input.name,
          description: input.description || null,
          automation_type: input.automation_type || null,
          trigger_type: input.trigger_type || 'enters_stage',
          pipeline_id: input.pipeline_id || null,
          trigger_stage_id: input.trigger_stage_id || null,
          stop_on_stage_ids: input.stop_on_stage_ids || [],
          config: input.config || null,
          exit_on_reply: input.config?.exit_on_reply ?? true,
          exit_to_stage_id: input.config?.exit_to_stage_id || null,
          no_reply_stage_id: input.config?.no_reply_stage_id || null,
          is_active: false, // Paused by default
        })
        .select()
        .single()

      if (automationError) throw automationError

      // Build and insert the steps
      const steps = buildAutomationSteps(
        automation.id,
        input.automation_type,
        input.config
      )

      if (steps.length > 0) {
        const { error: stepsError } = await supabase
          .from('automation_steps')
          .insert(steps)

        if (stepsError) throw stepsError
      }

      return automation
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] })
      queryClient.invalidateQueries({ queryKey: ['automation-stats'] })
    },
  })
}

export function useUpdateAutomation() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateAutomationInput) => {
      // Update the automation
      const { data: automation, error: automationError } = await supabase
        .from('automations')
        .update({
          name: input.name,
          description: input.description || null,
          automation_type: input.automation_type || null,
          trigger_type: input.trigger_type || 'enters_stage',
          pipeline_id: input.pipeline_id || null,
          trigger_stage_id: input.trigger_stage_id || null,
          stop_on_stage_ids: input.stop_on_stage_ids || [],
          config: input.config || null,
          exit_on_reply: input.config?.exit_on_reply ?? true,
          exit_to_stage_id: input.config?.exit_to_stage_id || null,
          no_reply_stage_id: input.config?.no_reply_stage_id || null,
        })
        .eq('id', input.id)
        .select()
        .single()

      if (automationError) throw automationError

      // Build new steps from config
      const newSteps = buildAutomationSteps(
        input.id,
        input.automation_type,
        input.config
      )

      // Get existing steps to update in-place (preserves IDs and FK references)
      const { data: existingSteps } = await supabase
        .from('automation_steps')
        .select('id, step_order')
        .eq('automation_id', input.id)
        .order('step_order')

      // Update existing steps or insert new ones
      for (const newStep of newSteps) {
        const existing = existingSteps?.find((s) => s.step_order === newStep.step_order)
        if (existing) {
          // Update existing step in-place (preserves step ID)
          const { automation_id: _aid, ...updateFields } = newStep
          const { error } = await supabase
            .from('automation_steps')
            .update(updateFields)
            .eq('id', existing.id)
          if (error) throw error
        } else {
          // Insert new step
          const { error } = await supabase
            .from('automation_steps')
            .insert(newStep)
          if (error) throw error
        }
      }

      // Delete excess steps (if new config has fewer steps)
      if (existingSteps && newSteps.length > 0) {
        const maxNewOrder = Math.max(...newSteps.map((s) => s.step_order))
        const excessIds = existingSteps
          .filter((s) => s.step_order > maxNewOrder)
          .map((s) => s.id)
        if (excessIds.length > 0) {
          const { error } = await supabase
            .from('automation_steps')
            .delete()
            .in('id', excessIds)
          if (error) throw error
        }
      }

      return automation
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['automations'] })
      queryClient.invalidateQueries({ queryKey: ['automation', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['automation-stats'] })
    },
  })
}

// ============================================
export function useDeleteAutomation() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (automationId: string) => {
      // Delete the automation - FK CASCADE handles steps, enrollments, and logs
      const { error } = await supabase
        .from('automations')
        .delete()
        .eq('id', automationId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] })
      queryClient.invalidateQueries({ queryKey: ['automation-stats'] })
    },
  })
}

export function useDuplicateAutomation() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (automationId: string) => {
      // Get the original automation with steps
      const { data: original, error: fetchError } = await supabase
        .from('automations')
        .select(`
          *,
          steps:automation_steps(*)
        `)
        .eq('id', automationId)
        .single()

      if (fetchError) throw fetchError

      // Create the duplicate automation
      const { data: duplicate, error: createError } = await supabase
        .from('automations')
        .insert({
          name: `${original.name} (Copy)`,
          description: original.description,
          pipeline_id: original.pipeline_id,
          trigger_stage_id: original.trigger_stage_id,
          trigger_type: original.trigger_type,
          automation_type: original.automation_type,
          stop_on_stage_ids: original.stop_on_stage_ids,
          config: original.config,
          exit_on_reply: original.exit_on_reply,
          is_active: false, // Duplicates are always paused
        })
        .select()
        .single()

      if (createError) throw createError

      // Duplicate all the steps
      if (original.steps && original.steps.length > 0) {
        const duplicatedSteps = original.steps.map((step: {
          step_order: number
          step_type: string
          delay_days: number
          delay_hours: number
          email_template_id: string | null
          sms_content: string | null
          target_stage_id: string | null
          conditions: Record<string, unknown> | null
        }) => ({
          automation_id: duplicate.id,
          step_order: step.step_order,
          step_type: step.step_type,
          delay_days: step.delay_days,
          delay_hours: step.delay_hours,
          email_template_id: step.email_template_id,
          sms_content: step.sms_content,
          target_stage_id: step.target_stage_id,
          conditions: step.conditions,
        }))

        const { error: stepsError } = await supabase
          .from('automation_steps')
          .insert(duplicatedSteps)

        if (stepsError) throw stepsError
      }

      return duplicate
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] })
      queryClient.invalidateQueries({ queryKey: ['automation-stats'] })
    },
  })
}

// Enrollment Management Hooks
// ============================================

export function useEnrollInAutomation() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ automationId, dealId }: { automationId: string; dealId: string }) => {
      // Get the first step of the automation
      const { data: firstStep, error: stepError } = await supabase
        .from('automation_steps')
        .select('id, delay_days, delay_hours')
        .eq('automation_id', automationId)
        .order('step_order', { ascending: true })
        .limit(1)
        .single()

      if (stepError) throw new Error('Automation has no steps')

      // Calculate next_step_at based on first step's delay
      const now = new Date()
      const delayMs =
        (firstStep.delay_days || 0) * 24 * 60 * 60 * 1000 +
        (firstStep.delay_hours || 0) * 60 * 60 * 1000
      const nextStepAt = new Date(now.getTime() + delayMs)

      // Create enrollment
      const { data: enrollment, error } = await supabase
        .from('automation_enrollments')
        .insert({
          automation_id: automationId,
          deal_id: dealId,
          status: 'active',
          current_step_id: firstStep.id,
          enrolled_at: now.toISOString(),
          next_step_at: nextStepAt.toISOString(),
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new Error('This deal is already enrolled in this automation')
        }
        throw error
      }

      return enrollment
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['automation-enrollments', variables.automationId] })
      queryClient.invalidateQueries({ queryKey: ['automation-stats', variables.automationId] })
      queryClient.invalidateQueries({ queryKey: ['contact-automations'] })
      queryClient.invalidateQueries({ queryKey: ['deal-automations'] })
    },
  })
}

export function useUnenrollFromAutomation() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ enrollmentId, automationId }: { enrollmentId: string; automationId?: string }) => {
      const { error } = await supabase
        .from('automation_enrollments')
        .update({
          status: 'stopped',
          stopped_reason: 'Manually unenrolled',
          next_step_at: null,
        })
        .eq('id', enrollmentId)

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      if (variables.automationId) {
        queryClient.invalidateQueries({ queryKey: ['automation-enrollments', variables.automationId] })
        queryClient.invalidateQueries({ queryKey: ['automation-stats', variables.automationId] })
      }
      queryClient.invalidateQueries({ queryKey: ['contact-automations'] })
      queryClient.invalidateQueries({ queryKey: ['deal-automations'] })
    },
  })
}

export function usePauseEnrollment() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ enrollmentId, automationId }: { enrollmentId: string; automationId?: string }) => {
      const { error } = await supabase
        .from('automation_enrollments')
        .update({
          status: 'paused',
        })
        .eq('id', enrollmentId)

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      if (variables.automationId) {
        queryClient.invalidateQueries({ queryKey: ['automation-enrollments', variables.automationId] })
        queryClient.invalidateQueries({ queryKey: ['automation-stats', variables.automationId] })
      }
      queryClient.invalidateQueries({ queryKey: ['contact-automations'] })
      queryClient.invalidateQueries({ queryKey: ['deal-automations'] })
    },
  })
}

export function useResumeEnrollment() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ enrollmentId, automationId }: { enrollmentId: string; automationId?: string }) => {
      // Get the enrollment to recalculate next_step_at
      const { data: enrollment, error: fetchError } = await supabase
        .from('automation_enrollments')
        .select('current_step_id')
        .eq('id', enrollmentId)
        .single()

      if (fetchError) throw fetchError

      // Get current step to calculate delay
      let nextStepAt = new Date()
      if (enrollment.current_step_id) {
        const { data: step } = await supabase
          .from('automation_steps')
          .select('delay_days, delay_hours')
          .eq('id', enrollment.current_step_id)
          .single()

        if (step) {
          const delayMs =
            (step.delay_days || 0) * 24 * 60 * 60 * 1000 +
            (step.delay_hours || 0) * 60 * 60 * 1000
          nextStepAt = new Date(nextStepAt.getTime() + delayMs)
        }
      }

      const { error } = await supabase
        .from('automation_enrollments')
        .update({
          status: 'active',
          next_step_at: nextStepAt.toISOString(),
        })
        .eq('id', enrollmentId)

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      if (variables.automationId) {
        queryClient.invalidateQueries({ queryKey: ['automation-enrollments', variables.automationId] })
        queryClient.invalidateQueries({ queryKey: ['automation-stats', variables.automationId] })
      }
      queryClient.invalidateQueries({ queryKey: ['contact-automations'] })
      queryClient.invalidateQueries({ queryKey: ['deal-automations'] })
    },
  })
}

export function useAvailableDealsForEnrollment(automationId: string | null, pipelineId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['available-deals-for-enrollment', automationId, pipelineId],
    queryFn: async () => {
      if (!automationId || !pipelineId) return []

      // Get deals in the same pipeline that are not already enrolled
      const { data: enrolledDeals } = await supabase
        .from('automation_enrollments')
        .select('deal_id')
        .eq('automation_id', automationId)
        .in('status', ['active', 'paused'])

      const enrolledDealIds = enrolledDeals?.map((e) => e.deal_id) || []

      let query = supabase
        .from('deals')
        .select(`
          id,
          title,
          contact:contacts(id, first_name, last_name, email)
        `)
        .eq('pipeline_id', pipelineId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (enrolledDealIds.length > 0) {
        query = query.not('id', 'in', `(${enrolledDealIds.join(',')})`)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    },
    enabled: !!automationId && !!pipelineId,
  })
}
