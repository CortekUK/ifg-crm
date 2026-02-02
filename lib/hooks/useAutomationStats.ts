import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

interface AutomationStats {
  totalAutomations: number
  active: number
  paused: number
  totalEnrolled: number
}

export function useAutomationStats() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['automation-stats'],
    queryFn: async (): Promise<AutomationStats> => {
      // Total automations
      const { count: totalAutomations } = await supabase
        .from('automations')
        .select('*', { count: 'exact', head: true })

      // Active automations
      const { count: active } = await supabase
        .from('automations')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      // Paused automations
      const { count: paused } = await supabase
        .from('automations')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', false)

      // Total enrolled (active enrollments across all automations)
      const { count: totalEnrolled } = await supabase
        .from('automation_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      return {
        totalAutomations: totalAutomations || 0,
        active: active || 0,
        paused: paused || 0,
        totalEnrolled: totalEnrolled || 0,
      }
    },
    refetchInterval: 60000,
  })
}
