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
      // Total contacts
      const { count: totalContacts } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })

      // New this month
      const firstOfMonth = new Date()
      firstOfMonth.setDate(1)
      firstOfMonth.setHours(0, 0, 0, 0)

      const { count: newThisMonth } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', firstOfMonth.toISOString())

      // Subscribed (active subscription)
      const { count: subscribed } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_status', 'subscribed')

      // Contacts with active deals
      const { data: contactsWithDeals } = await supabase
        .from('deals')
        .select('contact_id')
        .is('won_at', null)
        .is('lost_at', null)

      const uniqueContactsWithDeals = new Set(
        contactsWithDeals?.map((d) => d.contact_id).filter(Boolean)
      )

      return {
        totalContacts: totalContacts || 0,
        newThisMonth: newThisMonth || 0,
        subscribed: subscribed || 0,
        withDeals: uniqueContactsWithDeals.size,
      }
    },
    refetchInterval: 60000, // Refresh every minute
  })
}
