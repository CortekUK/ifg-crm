import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Payment, CreatePaymentInput } from '@/lib/types/payments'

export function usePayments() {
  const supabase = createClient()

  return useQuery<Payment[]>({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          invoice:invoices(id, invoice_number, deal:deals(id, pipeline_id, pipeline:pipelines(id, name))),
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
      const avgTransaction = successful.length > 0 ? totalReceived / successful.length : null

      return {
        totalReceived,
        pending: pendingTotal,
        failedCount: failed.length,
        avgTransaction,
      }
    },
  })
}

export function useCreatePayment() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreatePaymentInput) => {
      const { data, error } = await supabase
        .from('payments')
        .insert({
          ...input,
          status: 'successful',
          currency: input.currency || 'GBP',
        })
        .select()
        .single()

      if (error) throw error

      // If linked to an invoice, update invoice status to paid
      if (input.invoice_id) {
        const { error: invoiceError } = await supabase
          .from('invoices')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            payment_method: input.payment_method,
          })
          .eq('id', input.invoice_id)

        if (invoiceError) {
          throw new Error(`Payment recorded but invoice status update failed: ${invoiceError.message}`)
        }
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] })
    },
  })
}
