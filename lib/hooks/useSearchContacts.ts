import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Contact } from '@/lib/types/contacts'

export function useSearchContacts(search: string) {
  const supabase = createClient()

  return useQuery<Contact[]>({
    queryKey: ['contacts-search', search],
    queryFn: async () => {
      if (!search || search.length < 2) return []

      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
        )
        .limit(10)

      if (error) throw error
      return data || []
    },
    enabled: search.length >= 2,
  })
}
