import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchRankedContactIds, orderByIds } from '@/lib/contacts/search'
import type { Contact } from '@/lib/types/contacts'

/**
 * Contact picker search, e.g. "add contacts to this list".
 *
 * Uses the same `search_contacts_ranked` function the Contacts page does.
 * The previous hand-rolled version assumed the first typed word was the
 * first name and the last word the surname, so "Head Aila" found nobody,
 * and a multi-word term never checked the email column at all. It also
 * returned an arbitrary 50 rows with no relevance ordering, so an exact
 * match could be missing from a list of near-misses.
 */
const RESULT_LIMIT = 50

export function useSearchContacts(search: string) {
  const supabase = createClient()
  const term = search.trim()

  return useQuery<Contact[]>({
    queryKey: ['contacts-search', term || '__recent__'],
    queryFn: async () => {
      // Nothing typed yet — show the most recent contacts as a starting point.
      if (term.length < 2) {
        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(RESULT_LIMIT)

        if (error) throw error
        return data || []
      }

      const { ids } = await fetchRankedContactIds(supabase, {
        search: term,
        contactIds: null,
        limit: RESULT_LIMIT,
        offset: 0,
      })

      if (ids.length === 0) return []

      const { data, error } = await supabase.from('contacts').select('*').in('id', ids)
      if (error) throw error

      // Supabase returns rows in planner order, which would discard the ranking.
      return orderByIds(data || [], ids)
    },
  })
}
