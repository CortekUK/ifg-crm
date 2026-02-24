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
      const [
        { count: totalAutomations },
        { count: active },
        { count: paused },
        { count: totalEnrolled },
      ] = await Promise.all([
        supabase.from('automations').select('*', { count: 'exact', head: true }),
        supabase.from('automations').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('automations').select('*', { count: 'exact', head: true }).eq('is_active', false),
        supabase.from('automation_enrollments').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      ])

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
