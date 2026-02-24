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
      const [
        { count: totalTemplates },
        { count: automationTemplates },
        { count: campaignTemplates },
        { count: activeAutomations },
      ] = await Promise.all([
        supabase.from('email_templates').select('*', { count: 'exact', head: true }),
        supabase.from('email_templates').select('*', { count: 'exact', head: true }).eq('category', 'automation'),
        supabase.from('email_templates').select('*', { count: 'exact', head: true }).eq('category', 'campaign'),
        supabase.from('automations').select('*', { count: 'exact', head: true }).eq('is_active', true),
      ])

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
