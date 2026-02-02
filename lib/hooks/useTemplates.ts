import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Template, TemplateFilters, CreateTemplateInput } from '@/lib/types/templates'

export function useTemplates(filters?: TemplateFilters) {
  const supabase = createClient()

  return useQuery<Template[]>({
    queryKey: ['templates', filters],
    queryFn: async () => {
      let query = supabase
        .from('email_templates')
        .select('*')
        .order('updated_at', { ascending: false })

      // Apply filters
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,subject.ilike.%${filters.search}%`)
      }
      if (filters?.category && filters.category !== 'all') {
        query = query.eq('category', filters.category)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    },
  })
}

export function useTemplate(templateId: string | null) {
  const supabase = createClient()

  return useQuery<Template | null>({
    queryKey: ['template', templateId],
    queryFn: async () => {
      if (!templateId) return null
      
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('id', templateId)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!templateId,
  })
}

export function useCreateTemplate() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (template: CreateTemplateInput) => {
      const { data, error } = await supabase
        .from('email_templates')
        .insert(template)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
    },
  })
}

export function useDuplicateTemplate() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (template: Template) => {
      const { data: { user } } = await supabase.auth.getUser()
      
      const duplicateData = {
        name: `Copy of ${template.name}`,
        subject: template.subject,
        body_html: template.body_html,
        body_json: template.body_json,
        category: template.category,
        from_name_type: template.from_name_type,
        fixed_from_name: template.fixed_from_name,
        fixed_from_email: template.fixed_from_email,
        attachments: template.attachments,
        created_by_id: user?.id,
      }

      const { data, error } = await supabase
        .from('email_templates')
        .insert(duplicateData)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
    },
  })
}

export function useDeleteTemplate() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', templateId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
    },
  })
}

export function useTemplateUsage(templateId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['template-usage', templateId],
    queryFn: async () => {
      // Check if template is used in automations
      const { data: automationSteps, error } = await supabase
        .from('automation_steps')
        .select('id, automation:automations(id, name)')
        .eq('template_id', templateId)

      if (error) throw error

      const automations = automationSteps
        ?.map((step) => {
          const automation = step.automation as unknown as { id: string; name: string }[] | { id: string; name: string } | null
          // Handle both array and object cases from Supabase join
          if (Array.isArray(automation)) {
            return automation[0] || null
          }
          return automation
        })
        .filter((a): a is { id: string; name: string } => a !== null)
        .filter((v, i, arr) => arr.findIndex((a) => a.id === v.id) === i) // unique

      return {
        usedInAutomations: automations || [],
        isUsed: (automations?.length || 0) > 0,
      }
    },
    enabled: !!templateId,
  })
}
