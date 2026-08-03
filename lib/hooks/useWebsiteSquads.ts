'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { WebsiteSquad, WebsiteSquadInput } from '@/lib/types/website-content'

export function useSquads() {
  return useQuery<WebsiteSquad[]>({
    queryKey: ['website-squads'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('website_squads')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as WebsiteSquad[]
    },
  })
}

export function useSaveSquad() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: WebsiteSquadInput) => {
      const supabase = createClient()
      const { error } = input.id
        ? await supabase.from('website_squads').update(input).eq('id', input.id)
        : await supabase.from('website_squads').insert(input)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['website-squads'] }),
  })
}

export function useDeleteSquad() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('website_squads').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['website-squads'] }),
  })
}
