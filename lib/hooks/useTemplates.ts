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
