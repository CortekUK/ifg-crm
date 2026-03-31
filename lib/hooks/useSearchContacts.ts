import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Contact } from '@/lib/types/contacts'

export function useSearchContacts(search: string) {
  const supabase = createClient()

  return useQuery<Contact[]>({
    queryKey: ['contacts-search', search || '__recent__'],
    queryFn: async () => {
      let query = supabase.from('contacts').select('*')

      if (search && search.length >= 2) {
        // Split search into words so "Alex Mattes" matches first_name=Alex AND last_name=Mattes
        const words = search.trim().split(/\s+/).filter(Boolean)

        if (words.length >= 2) {
          // Multi-word: first word matches first_name, last word matches last_name
          query = query
            .ilike('first_name', `%${words[0]}%`)
            .ilike('last_name', `%${words[words.length - 1]}%`)
        } else {
          // Single word: match against first_name, last_name, or email
          query = query.or(
            `first_name.ilike.%${words[0]}%,last_name.ilike.%${words[0]}%,email.ilike.%${words[0]}%`
          )
        }
      } else {
        // No search — return recent contacts
        query = query.order('created_at', { ascending: false })
      }

      const { data, error } = await query.limit(50)

      if (error) throw error
      return data || []
    },
    enabled: true,
  })
}
