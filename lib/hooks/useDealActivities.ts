import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface DealActivity {
  id: string
  deal_id: string
  activity_type: string
  description: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  performed_by_id: string | null
  created_at: string
  performed_by?: {
    id: string
    full_name: string | null
    email: string
  } | null
}

export function useDealActivities(dealId: string | null) {
  const supabase = createClient()

  return useQuery<DealActivity[]>({
    queryKey: ['deal-activities', dealId],
    queryFn: async () => {
      if (!dealId) return []

      const { data, error } = await supabase
        .from('deal_activities')
        .select(`
          *,
          performed_by:profiles(id, full_name, email)
        `)
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: !!dealId,
  })
}

export function useAddDealNote() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      dealId,
      note,
      performedById,
    }: {
      dealId: string
      note: string
      performedById: string
    }) => {
      const { error } = await supabase.from('deal_activities').insert({
        deal_id: dealId,
        activity_type: 'note_added',
        description: note,
        performed_by_id: performedById,
      })

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal-activities', variables.dealId] })
    },
  })
}

export function useLogDealActivity() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      dealId,
      activityType,
      description,
      oldValue,
      newValue,
      performedById,
    }: {
      dealId: string
      activityType: string
      description: string
      oldValue?: Record<string, unknown>
      newValue?: Record<string, unknown>
      performedById?: string
    }) => {
      const { error } = await supabase.from('deal_activities').insert({
        deal_id: dealId,
        activity_type: activityType,
        description,
        old_value: oldValue || null,
        new_value: newValue || null,
        performed_by_id: performedById || null,
      })

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal-activities', variables.dealId] })
    },
  })
}
