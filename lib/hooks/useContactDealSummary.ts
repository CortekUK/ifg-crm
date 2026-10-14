'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface ContactDealSummary {
  contactId: string
  /** Pipeline names the contact already has a deal in. Empty = no deal yet. */
  pipelines: string[]
}

/**
 * "Does this person already have a deal, and in which programme?"
 *
 * Used by the Compose recipient picker so a recruiter can see, before they
 * write a word, whether the person they are about to email is already in a
 * pipeline. Without it the only way to know was to leave Compose, search
 * Contacts, open the record and look — so in practice nobody checked, and
 * duplicate deals were the result.
 *
 * One query for the whole visible page of suggestions rather than one per
 * row, because the picker re-renders on every keystroke.
 */
export function useContactDealSummary(contactIds: string[]) {
  const key = [...contactIds].sort().join(',')

  return useQuery<Record<string, ContactDealSummary>>({
    queryKey: ['contact-deal-summary', key],
    enabled: contactIds.length > 0,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('deals')
        .select('contact_id, pipeline:pipelines(name)')
        .in('contact_id', contactIds)
        .eq('status', 'active')
      if (error) throw error

      const out: Record<string, ContactDealSummary> = {}
      for (const id of contactIds) out[id] = { contactId: id, pipelines: [] }

      for (const row of (data ?? []) as unknown as {
        contact_id: string
        pipeline: { name: string | null } | null
      }[]) {
        const name = row.pipeline?.name
        if (!name) continue
        const entry = out[row.contact_id]
        if (entry && !entry.pipelines.includes(name)) entry.pipelines.push(name)
      }
      return out
    },
  })
}
