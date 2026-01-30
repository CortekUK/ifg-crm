import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Automation, AutomationLog, AutomationFilters, AutomationEnrollment, AutomationType, AutomationConfig } from '@/lib/types/automations'

export interface CreateAutomationInput {
  name: string
  description?: string | null
  automation_type?: AutomationType
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
      const { data, error } = await supabase
        .from('automations')
        .select(`
          *,
          pipeline:pipelines(*),
          trigger_stage:pipeline_stages!automations_trigger_stage_id_fkey(*),
          steps:automation_steps(*, template:email_templates(*))
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
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
          trigger_stage:pipeline_stages!automations_trigger_stage_id_fkey(*),
          steps:automation_steps(*, template:email_templates(*))
        `)
        .eq('id', automationId)
        .single()

      if (error) throw error
      return data
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

      // Get enrollment counts
      const { count: enrolledCount } = await supabase
        .from('automation_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('automation_id', automationId)
        .eq('status', 'active')

      const { count: completedCount } = await supabase
        .from('automation_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('automation_id', automationId)
        .eq('status', 'completed')

      // Get log counts
      const { count: sentCount } = await supabase
        .from('automation_logs')
        .select('*, step:automation_steps!inner(automation_id)', { count: 'exact', head: true })
        .eq('step.automation_id', automationId)
        .eq('status', 'sent')

      return {
        enrolled: enrolledCount || 0,
        completed: completedCount || 0,
        totalSent: sentCount || 0,
      }
    },
    enabled: !!automationId,
  })
}

// Helper function to build steps based on automation type and config
function buildAutomationSteps(
  automationId: string,
  automationType: AutomationType | undefined,
  config: AutomationConfig | null | undefined
): Array<{
  automation_id: string
  step_order: number
  step_type: 'send_email' | 'wait' | 'send_sms' | 'move_to_stage' | 'create_deal'
  delay_days: number
  delay_hours: number
  email_template_id: string | null
  sms_content: string | null
  target_stage_id: string | null
  conditions: Record<string, unknown> | null
}> {
  const steps: Array<{
    automation_id: string
    step_order: number
    step_type: 'send_email' | 'wait' | 'send_sms' | 'move_to_stage' | 'create_deal'
    delay_days: number
    delay_hours: number
    email_template_id: string | null
    sms_content: string | null
    target_stage_id: string | null
    conditions: Record<string, unknown> | null
  }> = []

  const emails = config?.emails || []
  const waitDays = config?.wait_days || [3, 5, 7]

  if (automationType === 'deal_creation') {
    // Deal creation automation - single step to create deal
    steps.push({
      automation_id: automationId,
      step_order: 1,
      step_type: 'create_deal',
      delay_days: 0,
      delay_hours: 0,
      email_template_id: null,
      sms_content: null,
      target_stage_id: null,
      conditions: null,
    })
  } else if (automationType === 'initial_contact' || automationType === 'follow_up') {
    // Email sequence automation - 3 emails with waits between
    let stepOrder = 1

    // Email 1
    steps.push({
      automation_id: automationId,
      step_order: stepOrder++,
      step_type: 'send_email',
      delay_days: 0,
      delay_hours: 0,
      email_template_id: emails[0]?.template_id || null,
      sms_content: null,
      target_stage_id: null,
      conditions: null,
    })

    // Wait 1
    steps.push({
      automation_id: automationId,
      step_order: stepOrder++,
      step_type: 'wait',
      delay_days: waitDays[0] || 3,
      delay_hours: 0,
      email_template_id: null,
      sms_content: null,
      target_stage_id: null,
      conditions: null,
    })

    // Email 2
    steps.push({
      automation_id: automationId,
      step_order: stepOrder++,
      step_type: 'send_email',
      delay_days: 0,
      delay_hours: 0,
      email_template_id: emails[1]?.template_id || null,
      sms_content: null,
      target_stage_id: null,
      conditions: null,
    })

    // Wait 2
    steps.push({
      automation_id: automationId,
      step_order: stepOrder++,
      step_type: 'wait',
      delay_days: waitDays[1] || 5,
      delay_hours: 0,
      email_template_id: null,
      sms_content: null,
      target_stage_id: null,
      conditions: null,
    })

    // Email 3
    steps.push({
      automation_id: automationId,
      step_order: stepOrder++,
      step_type: 'send_email',
      delay_days: 0,
      delay_hours: 0,
      email_template_id: emails[2]?.template_id || null,
      sms_content: null,
      target_stage_id: null,
      conditions: null,
    })

    // For follow_up type, add final wait and move_to_stage if configured
    if (automationType === 'follow_up' && config?.final_stage_id) {
      steps.push({
        automation_id: automationId,
        step_order: stepOrder++,
        step_type: 'wait',
        delay_days: waitDays[2] || 7,
        delay_hours: 0,
        email_template_id: null,
        sms_content: null,
        target_stage_id: null,
        conditions: null,
      })

      steps.push({
        automation_id: automationId,
        step_order: stepOrder++,
        step_type: 'move_to_stage',
        delay_days: 0,
        delay_hours: 0,
        email_template_id: null,
        sms_content: null,
        target_stage_id: config.final_stage_id,
        conditions: null,
      })
    }
  }

  return steps
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
          pipeline_id: input.pipeline_id,
          trigger_stage_id: input.trigger_stage_id,
          stop_on_stage_ids: input.stop_on_stage_ids || [],
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
          pipeline_id: input.pipeline_id,
          trigger_stage_id: input.trigger_stage_id,
          stop_on_stage_ids: input.stop_on_stage_ids || [],
        })
        .eq('id', input.id)
        .select()
        .single()

      if (automationError) throw automationError

      // Delete existing steps
      const { error: deleteError } = await supabase
        .from('automation_steps')
        .delete()
        .eq('automation_id', input.id)

      if (deleteError) throw deleteError

      // Build and insert new steps
      const steps = buildAutomationSteps(
        input.id,
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['automations'] })
      queryClient.invalidateQueries({ queryKey: ['automation', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['automation-stats'] })
    },
  })
}
