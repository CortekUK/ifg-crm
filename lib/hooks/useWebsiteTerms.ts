'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { TermsProgramme } from '@/lib/stripe'

export interface WebsiteTerms {
  programme: TermsProgramme
  title: string
  body: string
  version: number
  published: boolean
  updated_at: string
  updated_by: string | null
}

export function useWebsiteTerms() {
  return useQuery<WebsiteTerms[]>({
    queryKey: ['website-terms'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('website_terms')
        .select('*')
        .order('programme')
      if (error) throw error
      return (data ?? []) as WebsiteTerms[]
    },
  })
}

export interface SaveTermsInput {
  programme: TermsProgramme
  title: string
  body: string
  published: boolean
  /** The row as loaded, so we can tell whether the wording actually changed. */
  previousBody: string
  previousVersion: number
}

export function useSaveTerms() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: SaveTermsInput) => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // The version identifies the wording someone agreed to at checkout, so
      // it moves only when the wording moves. Fixing a typo in the title, or
      // publishing text that is already written, must not invalidate the
      // record of what earlier customers accepted.
      const bodyChanged = input.body.trim() !== input.previousBody.trim()

      const { error } = await supabase
        .from('website_terms')
        .update({
          title: input.title,
          body: input.body,
          published: input.published,
          version: bodyChanged ? input.previousVersion + 1 : input.previousVersion,
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        })
        .eq('programme', input.programme)

      if (error) throw error
      return { bumped: bodyChanged }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['website-terms'] }),
  })
}
