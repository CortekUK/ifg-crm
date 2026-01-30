import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Payment } from '@/lib/types/payments'

export function usePayments() {
  const supabase = createClient()

  return useQuery<Payment[]>({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          invoice:invoices(id, invoice_number),
          contact:contacts(id, first_name, last_name, email),
          recorded_by:profiles(id, full_name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
  })
}

export function usePaymentStats() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['payment-stats'],
    queryFn: async () => {
      // Get current month's payments
      const now = new Date()
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const { data: payments, error } = await supabase
        .from('payments')
        .select('amount, status')
        .gte('created_at', firstOfMonth)

      if (error) throw error

      const successful = payments?.filter((p) => p.status === 'successful') || []
      const pending = payments?.filter((p) => p.status === 'pending') || []
      const failed = payments?.filter((p) => p.status === 'failed') || []

      const totalReceived = successful.reduce((sum, p) => sum + (p.amount || 0), 0)
      const pendingTotal = pending.reduce((sum, p) => sum + (p.amount || 0), 0)
      const avgTransaction = successful.length > 0 ? totalReceived / successful.length : 0

      return {
        totalReceived,
        pending: pendingTotal,
        failedCount: failed.length,
        avgTransaction,
      }
    },
  })
}
