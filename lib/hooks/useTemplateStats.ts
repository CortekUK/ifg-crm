import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

interface TemplateStats {
  totalTemplates: number
  emailTemplates: number
  smsTemplates: number
  activeAutomations: number
}

export function useTemplateStats() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['template-stats'],
    queryFn: async (): Promise<TemplateStats> => {
      // Total templates
      const { count: totalTemplates } = await supabase
        .from('email_templates')
        .select('*', { count: 'exact', head: true })

      // Automation templates
      const { count: automationTemplates } = await supabase
        .from('email_templates')
        .select('*', { count: 'exact', head: true })
        .eq('category', 'automation')

      // Campaign templates
      const { count: campaignTemplates } = await supabase
        .from('email_templates')
        .select('*', { count: 'exact', head: true })
        .eq('category', 'campaign')

      // Count active automations
      const { count: activeAutomations } = await supabase
        .from('automations')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      return {
        totalTemplates: totalTemplates || 0,
        emailTemplates: automationTemplates || 0,
        smsTemplates: campaignTemplates || 0,
        activeAutomations: activeAutomations || 0,
      }
    },
    refetchInterval: 60000,
  })
}
