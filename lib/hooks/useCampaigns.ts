import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Campaign, CampaignFilters } from '@/lib/types/campaigns'

export function useCampaigns(filters?: CampaignFilters) {
  const supabase = createClient()

  return useQuery<Campaign[]>({
    queryKey: ['campaigns', filters],
    queryFn: async () => {
      let query = supabase
        .from('campaigns')
        .select(`
          *,
          template:email_templates(*),
          from_user:profiles!campaigns_from_user_id_fkey(id, email, full_name),
          created_by:profiles!campaigns_created_by_id_fkey(id, email, full_name)
        `)
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`)
      }
      if (filters?.type && filters.type !== 'all') {
        query = query.eq('type', filters.type)
      }
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    },
  })
}

export function useCreateCampaign() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (campaign: {
      name: string
      type: 'email' | 'sms'
      status: 'draft' | 'scheduled'
      email_template_id?: string
      sms_content?: string
      from_user_id: string
      created_by_id: string
      scheduled_at?: string
    }) => {
      const { data, error } = await supabase
        .from('campaigns')
        .insert(campaign)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

export function useLists() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['lists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lists')
        .select('*')
        .order('name')

      if (error) throw error
      return data || []
    },
  })
}

export function useEmailTemplates() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('category', 'campaign')
        .order('name')

      if (error) throw error
      return data || []
    },
  })
}
