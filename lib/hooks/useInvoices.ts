import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Invoice, InvoiceFilters, CreateInvoiceInput, InvoiceStatus } from '@/lib/types/invoices'
import { applyPaymentReceived } from '@/lib/payments/notify-payment-received'

export function useInvoices(filters?: InvoiceFilters) {
  const supabase = createClient()

  return useQuery<Invoice[]>({
    queryKey: ['invoices', filters],
    queryFn: async () => {
      // The profiles embed MUST name its foreign key. `invoices` has two
      // links to `profiles` — `created_by_id` and, since migration 212 added
      // the abandoned-checkout columns, `abandoned_handled_by`. With two
      // candidates and no hint, PostgREST refuses the WHOLE query with
      // PGRST201 rather than guessing, so the Invoices page showed "No
      // invoices" to every staff member while the invoices sat there
      // untouched — nobody could send, cancel or take payment from the list.
      // Adding a second FK to a table is enough to break an existing
      // unqualified embed, which is why this is spelled out.
      let query = supabase
        .from('invoices')
        .select(`
          *,
          contact:contacts(*),
          deal:deals(*, pipeline:pipelines(*)),
          created_by:profiles!invoices_created_by_id_fkey(*)
        `)
        .order('created_at', { ascending: false })

      // Apply server-side filters that work directly on the invoices table
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }
      if (filters?.type && filters.type !== 'all') {
        query = query.eq('type', filters.type)
      }

      const { data, error } = await query

      if (error) throw error

      let results = data || []

      // Client-side filters for joined data and text search
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase()
        results = results.filter((inv) => {
          const contactName = inv.contact
            ? `${inv.contact.first_name || ''} ${inv.contact.last_name || ''}`.toLowerCase()
            : ''
          const invoiceNum = inv.invoice_number?.toLowerCase() || ''
          return invoiceNum.includes(searchLower) || contactName.includes(searchLower)
        })
      }

      if (filters?.pipelineId) {
        results = results.filter((inv) => inv.deal?.pipeline?.id === filters.pipelineId)
      }

      if (filters?.dateFrom) {
        const from = new Date(filters.dateFrom)
        results = results.filter((inv) => new Date(inv.due_date) >= from)
      }

      if (filters?.dateTo) {
        const to = new Date(filters.dateTo)
        results = results.filter((inv) => new Date(inv.due_date) <= to)
      }

      return results
    },
  })
}

/**
 * Website checkouts that reached Stripe but haven't been paid — i.e. someone
 * pressed "pay deposit / pay in full" on the site and dropped off. These are
 * warm leads for IFG to follow up (especially off Meta-ad traffic). A website
 * checkout always has a stripe_checkout_session_id, and once paid the webhook
 * flips it to 'paid' — so anything unpaid with a session id is an abandoned
 * checkout.
 *
 * 'draft' counts. A website checkout starts as draft and only becomes 'sent'
 * once its payment-link email is confirmed; a drop-off whose email bounced is
 * still a drop-off, and excluding draft would hide them from the one screen
 * that exists to chase them.
 */
export function useAbandonedDeposits() {
  const supabase = createClient()

  return useQuery<Invoice[]>({
    queryKey: ['abandoned-deposits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`*, contact:contacts(*)`)
        .in('type', ['deposit', 'full_payment'])
        .in('status', ['draft', 'sent', 'overdue'])
        .not('stripe_checkout_session_id', 'is', null)
        // Anything a staff member has already chased is out of the list. See
        // migration 212 — before this the only way to clear a row was to mark
        // it paid, which faked a payment.
        .is('abandoned_handled_at', null)
        .order('created_at', { ascending: false })

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
          created_by:profiles!invoices_created_by_id_fkey(*)
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

      // Notify player when invoice is sent
      if (status === 'sent') {
        const { data: invoice } = await supabase
          .from('invoices')
          .select('contact_id, invoice_number, amount, currency')
          .eq('id', invoiceId)
          .single()

        if (invoice?.contact_id) {
          const { data: playerProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('contact_id', invoice.contact_id)
            .eq('role', 'player')
            .single()

          if (playerProfile) {
            const formatted = new Intl.NumberFormat('en-GB', { style: 'currency', currency: invoice.currency || 'GBP' }).format(invoice.amount)
            await supabase.from('notifications').insert({
              user_id: playerProfile.id,
              type: 'payment',
              title: 'New Invoice',
              message: `Invoice ${invoice.invoice_number} for ${formatted} is ready for payment.`,
              href: '/portal/invoices',
            })
          }
        }
      }

      // Notify player when invoice is cancelled
      if (status === 'cancelled') {
        const { data: invoice } = await supabase
          .from('invoices')
          .select('contact_id, invoice_number, amount, currency, stripe_checkout_session_id')
          .eq('id', invoiceId)
          .single()

        if (invoice?.contact_id) {
          const formatted = new Intl.NumberFormat('en-GB', { style: 'currency', currency: invoice.currency || 'GBP' }).format(invoice.amount)

          // In-app notification
          const { data: playerProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('contact_id', invoice.contact_id)
            .eq('role', 'player')
            .single()

          if (playerProfile) {
            await supabase.from('notifications').insert({
              user_id: playerProfile.id,
              type: 'payment',
              title: 'Invoice Cancelled',
              message: `Invoice ${invoice.invoice_number} for ${formatted} has been cancelled.`,
              href: '/portal/invoices',
            })
          }

          // Send cancellation email
          const { data: contact } = await supabase
            .from('contacts')
            .select('email, first_name, last_name')
            .eq('id', invoice.contact_id)
            .single()

          if (contact?.email) {
            try {
              const res = await fetch('/api/invoices/notify-cancellation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: contact.email,
                  name: `${contact.first_name} ${contact.last_name}`,
                  invoice_number: invoice.invoice_number,
                  amount: formatted,
                }),
              })
              if (!res.ok) console.error('Failed to send cancellation email')
            } catch (err) {
              console.error('Cancellation email error:', err)
            }
          }

          // Expire Stripe checkout session if exists
          if (invoice.stripe_checkout_session_id) {
            try {
              await fetch('/api/stripe/expire-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: invoice.stripe_checkout_session_id }),
              })
            } catch {}
          }
        }
      }

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoiceId)

      if (error) throw error

      // Marking an invoice paid by hand has to do everything a card payment
      // does — move the deal to Deposit Paid, end the chasing sequences, tell
      // staff. None of that happened here, so a player who paid by bank
      // transfer kept being chased for the deposit they had already sent.
      // Needs the service-role key, hence the route.
      if (status === 'paid') {
        await applyPaymentReceived(invoiceId, 'manual')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
    },
  })
}

/**
 * Take an abandoned checkout off the panel without touching the invoice.
 *
 * Deliberately not a status change: the invoice is still genuinely unpaid and
 * may yet be paid, so it keeps its status and simply stops appearing in the
 * "needs chasing" list.
 */
export function useMarkAbandonedHandled() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ invoiceId, handled }: { invoiceId: string; handled: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('invoices')
        .update({
          abandoned_handled_at: handled ? new Date().toISOString() : null,
          abandoned_handled_by: handled ? user?.id ?? null : null,
        })
        .eq('id', invoiceId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['abandoned-deposits'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
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
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] })
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

      // Same reasoning as the single-invoice path above: a bulk Mark Paid is
      // still a payment, and each deal has to move and stop being chased.
      if (status === 'paid') {
        for (const id of invoiceIds) await applyPaymentReceived(id, 'manual')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
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
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      // Run all 4 independent queries in parallel
      const [
        { data: outstanding },
        { data: paidThisMonth },
        { count: overdueCount },
        { data: paidInvoices },
      ] = await Promise.all([
        // Outstanding amount
        supabase.from('invoices').select('amount').in('status', ['sent', 'overdue']),
        // Paid this month
        supabase.from('invoices').select('amount').eq('status', 'paid').gte('paid_at', startOfMonth.toISOString()),
        // Overdue count
        supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('status', 'overdue'),
        // Avg payment days (invoices with both sent_at and paid_at)
        supabase.from('invoices').select('sent_at, paid_at').eq('status', 'paid').not('sent_at', 'is', null).not('paid_at', 'is', null),
      ])

      let avgPaymentDays: number | null = null
      if (paidInvoices && paidInvoices.length > 0) {
        const totalDays = paidInvoices.reduce((sum, inv) => {
          const sent = new Date(inv.sent_at!).getTime()
          const paid = new Date(inv.paid_at!).getTime()
          const diffDays = Math.max(0, Math.round((paid - sent) / (1000 * 60 * 60 * 24)))
          return sum + diffDays
        }, 0)
        avgPaymentDays = Math.round(totalDays / paidInvoices.length)
      }

      const totalOutstanding = outstanding?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0
      const totalPaidThisMonth = paidThisMonth?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0

      return {
        totalOutstanding,
        paidThisMonth: totalPaidThisMonth,
        overdueCount: overdueCount || 0,
        avgPaymentDays,
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
