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

      // Email templates
      const { count: emailTemplates } = await supabase
        .from('email_templates')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'email')

      // SMS templates
      const { count: smsTemplates } = await supabase
        .from('email_templates')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'sms')

      // Templates used in active automations
      const { data: automationTemplates } = await supabase
        .from('automations')
        .select('template_id')
        .eq('is_active', true)
        .not('template_id', 'is', null)

      const uniqueTemplatesInAutomations = new Set(
        automationTemplates?.map((a) => a.template_id).filter(Boolean)
      )

      return {
        totalTemplates: totalTemplates || 0,
        emailTemplates: emailTemplates || 0,
        smsTemplates: smsTemplates || 0,
        activeAutomations: uniqueTemplatesInAutomations.size,
      }
    },
    refetchInterval: 60000,
  })
}
