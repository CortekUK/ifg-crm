'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ContactSuggestion } from '@/lib/outlook/suggest-contacts'

/**
 * Ranked contact suggestions for an unmatched sender.
 *
 * Cached by address, and PREFETCHED while the Unmatched list is on screen.
 * Ranking costs several database round trips against 179,000 contacts, so
 * asking for it at the moment the dialog opens meant staring at a spinner for
 * over a second before anything appeared. Fetching it while the list is being
 * read means the dialog has the answer before it is opened.
 */
const KEY = (email: string) => ['contact-suggestions', email.toLowerCase()]

async function fetchSuggestions(email: string, name: string | null): Promise<ContactSuggestion[]> {
  const params = new URLSearchParams({ email })
  if (name) params.set('name', name)
  const res = await fetch(`/api/outlook/suggest?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  return (data.suggestions ?? []) as ContactSuggestion[]
}

export function useSuggestions(email: string | null, name: string | null) {
  return useQuery({
    queryKey: KEY(email ?? ''),
    enabled: !!email,
    queryFn: () => fetchSuggestions(email as string, name),
    // The ranking only changes when contacts change, which is rare relative to
    // how often a dialog is opened and closed while triaging a few emails.
    staleTime: 5 * 60_000,
  })
}

/** Warm the cache for the rows currently on screen. */
export function usePrefetchSuggestions() {
  const queryClient = useQueryClient()

  return (rows: { counterparty_email: string | null; counterparty_name: string | null }[]) => {
    for (const row of rows) {
      if (!row.counterparty_email) continue
      queryClient.prefetchQuery({
        queryKey: KEY(row.counterparty_email),
        queryFn: () => fetchSuggestions(row.counterparty_email as string, row.counterparty_name),
        staleTime: 5 * 60_000,
      })
    }
  }
}
