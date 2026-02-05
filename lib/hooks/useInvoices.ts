import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Invoice, InvoiceFilters, CreateInvoiceInput, InvoiceStatus } from '@/lib/types/invoices'

export function useInvoices(filters?: InvoiceFilters) {
  const supabase = createClient()

  return useQuery<Invoice[]>({
    queryKey: ['invoices', filters],
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          contact:contacts(*),
          deal:deals(*, pipeline:pipelines(*)),
          created_by:profiles(*)
        `)
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters?.search) {
        query = query.or(`invoice_number.ilike.%${filters.search}%`)
      }
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }
      if (filters?.type && filters.type !== 'all') {
        query = query.eq('type', filters.type)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    },
  })
}

export function useInvoice(invoiceId: string | null) {
  const supabase = createClient()

  return useQuery<Invoice | null>({
    queryKey: ['invoice', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return null

      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          contact:contacts(*),
          deal:deals(*, pipeline:pipelines(*)),
          created_by:profiles(*)
        `)
        .eq('id', invoiceId)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!invoiceId,
  })
}

export function useCreateInvoice() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (invoice: CreateInvoiceInput) => {
      const { data, error } = await supabase
        .from('invoices')
        .insert({
          ...invoice,
          currency: invoice.currency || 'GBP',
          status: 'draft',
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useUpdateInvoiceStatus() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      invoiceId,
      status,
      additionalFields,
    }: {
      invoiceId: string
      status: InvoiceStatus
      additionalFields?: Partial<Invoice>
    }) => {
      const updateData: Record<string, unknown> = { status, ...additionalFields }

      // Set timestamps based on status
      if (status === 'sent' && !additionalFields?.sent_at) {
        updateData.sent_at = new Date().toISOString()
      }
      if (status === 'paid' && !additionalFields?.paid_at) {
        updateData.paid_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoiceId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice'] })
    },
  })
}

export function useDeleteInvoice() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useBulkUpdateInvoiceStatus() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      invoiceIds,
      status,
    }: {
      invoiceIds: string[]
      status: InvoiceStatus
    }) => {
      const updateData: Record<string, unknown> = { status }

      // Set timestamps based on status
      if (status === 'sent') {
        updateData.sent_at = new Date().toISOString()
      }
      if (status === 'paid') {
        updateData.paid_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .in('id', invoiceIds)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] })
    },
  })
}

export function useBulkDeleteInvoices() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (invoiceIds: string[]) => {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .in('id', invoiceIds)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] })
    },
  })
}

export function useInvoiceStats() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['invoice-stats'],
    queryFn: async () => {
      // Get outstanding amount
      const { data: outstanding } = await supabase
        .from('invoices')
        .select('amount')
        .in('status', ['sent', 'overdue'])

      // Get paid this month
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { data: paidThisMonth } = await supabase
        .from('invoices')
        .select('amount')
        .eq('status', 'paid')
        .gte('paid_at', startOfMonth.toISOString())

      // Get overdue count
      const { count: overdueCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'overdue')

      const totalOutstanding = outstanding?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0
      const totalPaidThisMonth = paidThisMonth?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0

      return {
        totalOutstanding,
        paidThisMonth: totalPaidThisMonth,
        overdueCount: overdueCount || 0,
        avgPaymentDays: 7, // Placeholder - would need to calculate from actual data
      }
    },
  })
}

export function useContactDeals(contactId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['contact-deals', contactId],
    queryFn: async () => {
      if (!contactId) return []

      const { data, error } = await supabase
        .from('deals')
        .select('*, pipeline:pipelines(*)')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: !!contactId,
  })
}
