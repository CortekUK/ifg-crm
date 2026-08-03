'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { WebsiteNews, WebsiteNewsInput } from '@/lib/types/website-content'

export function useNews() {
  return useQuery<WebsiteNews[]>({
    queryKey: ['website-news'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('website_news')
        .select('*')
        .order('published_at', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as WebsiteNews[]
    },
  })
}

export function useSaveNews() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: WebsiteNewsInput) => {
      const supabase = createClient()
      const { error } = input.id
        ? await supabase.from('website_news').update(input).eq('id', input.id)
        : await supabase.from('website_news').insert(input)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['website-news'] }),
  })
}

export function useDeleteNews() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('website_news').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['website-news'] }),
  })
}
