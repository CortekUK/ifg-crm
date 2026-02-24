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
      const firstOfMonth = new Date()
      firstOfMonth.setDate(1)
      firstOfMonth.setHours(0, 0, 0, 0)

      const [totalResult, newResult, subscribedResult, dealsResult] = await Promise.all([
        // Total contacts
        supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true }),

        // New this month
        supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', firstOfMonth.toISOString()),

        // Subscribed (active subscription)
        supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('subscription_status', 'subscribed'),

        // Contacts with active deals — only select contact_id
        supabase
          .from('deals')
          .select('contact_id')
          .is('won_at', null)
          .is('lost_at', null),
      ])

      const uniqueContactsWithDeals = new Set(
        dealsResult.data?.map((d) => d.contact_id).filter(Boolean)
      )

      return {
        totalContacts: totalResult.count || 0,
        newThisMonth: newResult.count || 0,
        subscribed: subscribedResult.count || 0,
        withDeals: uniqueContactsWithDeals.size,
      }
    },
    refetchInterval: 60000, // Refresh every minute
  })
}
