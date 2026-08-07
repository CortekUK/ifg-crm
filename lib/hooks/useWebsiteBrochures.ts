'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { WebsiteBrochure, WebsiteBrochureInput } from '@/lib/types/website-content'

export function useBrochures() {
  return useQuery<WebsiteBrochure[]>({
    queryKey: ['website-brochures'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('website_brochures')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as WebsiteBrochure[]
    },
  })
}

export function useSaveBrochure() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: WebsiteBrochureInput) => {
      const supabase = createClient()
      const { error } = input.id
        ? await supabase.from('website_brochures').update(input).eq('id', input.id)
        : await supabase.from('website_brochures').insert(input)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['website-brochures'] }),
  })
}

export function useDeleteBrochure() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('website_brochures').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['website-brochures'] }),
  })
}
