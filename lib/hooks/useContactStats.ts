import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

interface ContactStats {
  totalContacts: number
  newThisMonth: number
  subscribed: number
  withDeals: number
}

export function useContactStats() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['contact-stats'],
    queryFn: async (): Promise<ContactStats> => {
      // One round trip instead of three exact counts over 105k contacts plus a
      // full read of deals to de-duplicate client-side.
      const { data, error } = await supabase.rpc('get_contact_stats')
      if (error) throw error

      const row = (data as {
        total_contacts: number
        new_this_month: number
        subscribed: number
        with_deals: number
      }[] | null)?.[0]

      return {
        totalContacts: Number(row?.total_contacts ?? 0),
        newThisMonth: Number(row?.new_this_month ?? 0),
        subscribed: Number(row?.subscribed ?? 0),
        withDeals: Number(row?.with_deals ?? 0),
      }
    },
    // Counting 105k contacts every minute is a lot of work for a number that
    // barely moves; refresh on navigation and after mutations instead.
    staleTime: 5 * 60 * 1000,
  })
}
