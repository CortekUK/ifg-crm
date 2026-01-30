import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Automation, AutomationLog, AutomationFilters, AutomationEnrollment } from '@/lib/types/automations'

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
