'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { WebsitePageRow, WebsitePageInput } from '@/lib/types/website-content'

// All page-override rows (small table — one row per edited page).
export function useWebsitePages() {
  return useQuery<WebsitePageRow[]>({
    queryKey: ['website-pages'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('website_pages')
        .select('*')
        .order('slug', { ascending: true })
      if (error) throw error
      return (data ?? []) as WebsitePageRow[]
    },
  })
}

// Upsert a page's overrides + published state (slug is unique).
export function useSaveWebsitePage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: WebsitePageInput) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('website_pages')
        .upsert(input, { onConflict: 'slug' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['website-pages'] }),
  })
}
