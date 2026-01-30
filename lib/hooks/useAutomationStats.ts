import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

interface AutomationStats {
  totalAutomations: number
  active: number
  paused: number
  runsThisMonth: number
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

      // Runs this month
      const firstOfMonth = new Date()
      firstOfMonth.setDate(1)
      firstOfMonth.setHours(0, 0, 0, 0)

      const { count: runsThisMonth } = await supabase
        .from('automation_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', firstOfMonth.toISOString())

      return {
        totalAutomations: totalAutomations || 0,
        active: active || 0,
        paused: paused || 0,
        runsThisMonth: runsThisMonth || 0,
      }
    },
    refetchInterval: 60000,
  })
}
