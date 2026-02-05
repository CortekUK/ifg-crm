'use client'

import { useState, useEffect } from 'react'
import { InvoicesPageHeader } from '@/components/invoices/InvoicesPageHeader'
import { InvoiceStats } from '@/components/invoices/InvoiceStats'
import { InvoiceFilters } from '@/components/invoices/InvoiceFilters'
import { InvoicesTable } from '@/components/invoices/InvoicesTable'
import { CreateInvoiceModal } from '@/components/invoices/CreateInvoiceModal'
import { CreatePaymentPlanModal } from '@/components/invoices/CreatePaymentPlanModal'
import { InvoiceDetailSheet } from '@/components/invoices/InvoiceDetailSheet'
import {
  useInvoices,
  useInvoiceStats,
  useUpdateInvoiceStatus,
  useDeleteInvoice,
  useBulkUpdateInvoiceStatus,
  useBulkDeleteInvoices,
} from '@/lib/hooks/useInvoices'
import { toast } from '@/lib/hooks/use-toast'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { createClient } from '@/lib/supabase/client'
import type { InvoiceFilters as InvoiceFiltersType, Invoice } from '@/lib/types/invoices'

export default function InvoicesPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [filters, setFilters] = useState<InvoiceFiltersType>({})
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [paymentPlanModalOpen, setPaymentPlanModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  // Debounce search
  const debouncedFilters = {
    ...filters,
    search: useDebouncedValue(filters.search || '', 300),
  }

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    fetchUser()
  }, [])

  // Fetch invoices and stats
  const { data: invoices = [], isLoading } = useInvoices(debouncedFilters)
  const { data: stats, isLoading: statsLoading } = useInvoiceStats()
  const updateStatus = useUpdateInvoiceStatus()
  const deleteInvoice = useDeleteInvoice()
  const bulkUpdateStatus = useBulkUpdateInvoiceStatus()
  const bulkDeleteInvoices = useBulkDeleteInvoices()

  const handleView = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
  }

  const handleSend = async (invoice: Invoice) => {
    try {
      await updateStatus.mutateAsync({ invoiceId: invoice.id, status: 'sent' })
    } catch (error) {
      console.error('Failed to send invoice:', error)
    }
  }

  const handleMarkPaid = async (invoice: Invoice) => {
    try {
      await updateStatus.mutateAsync({ invoiceId: invoice.id, status: 'paid' })
    } catch (error) {
      console.error('Failed to mark invoice as paid:', error)
    }
  }

  const handleDelete = async (invoice: Invoice) => {
    if (confirm(`Are you sure you want to delete invoice ${invoice.invoice_number}?`)) {
      try {
        await deleteInvoice.mutateAsync(invoice.id)
      } catch (error) {
        console.error('Failed to delete invoice:', error)
      }
    }
  }

  const handleBulkSend = async (ids: string[]) => {
    // Filter to only draft invoices
    const draftIds = invoices
      .filter((inv) => ids.includes(inv.id) && inv.status === 'draft')
      .map((inv) => inv.id)

    if (draftIds.length === 0) {
      toast({
        title: 'No draft invoices selected',
        description: 'Only draft invoices can be sent.',
        variant: 'destructive',
      })
      return
    }

    try {
      await bulkUpdateStatus.mutateAsync({ invoiceIds: draftIds, status: 'sent' })
      setSelectedIds([])
      toast({
        title: 'Invoices sent',
        description: `${draftIds.length} invoice(s) sent successfully.`,
      })
    } catch (error) {
      toast({
        title: 'Failed to send invoices',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleBulkMarkPaid = async (ids: string[]) => {
    // Filter to only unpaid/uncancelled invoices
    const unpaidIds = invoices
      .filter((inv) => ids.includes(inv.id) && inv.status !== 'paid' && inv.status !== 'cancelled')
      .map((inv) => inv.id)

    if (unpaidIds.length === 0) {
      toast({
        title: 'No unpaid invoices selected',
        description: 'Only unpaid invoices can be marked as paid.',
        variant: 'destructive',
      })
      return
    }

    try {
      await bulkUpdateStatus.mutateAsync({ invoiceIds: unpaidIds, status: 'paid' })
      setSelectedIds([])
      toast({
        title: 'Invoices marked as paid',
        description: `${unpaidIds.length} invoice(s) marked as paid.`,
      })
    } catch (error) {
      toast({
        title: 'Failed to update invoices',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleBulkDelete = async (ids: string[]) => {
    if (!confirm(`Are you sure you want to delete ${ids.length} invoice(s)?`)) return

    try {
      await bulkDeleteInvoices.mutateAsync(ids)
      setSelectedIds([])
      toast({
        title: 'Invoices deleted',
        description: `${ids.length} invoice(s) deleted successfully.`,
      })
    } catch (error) {
      toast({
        title: 'Failed to delete invoices',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <InvoicesPageHeader
        onCreateClick={() => setCreateModalOpen(true)}
        onCreatePaymentPlan={() => setPaymentPlanModalOpen(true)}
      />

      {/* Stats */}
      <InvoiceStats
        totalOutstanding={stats?.totalOutstanding || 0}
        paidThisMonth={stats?.paidThisMonth || 0}
        overdueCount={stats?.overdueCount || 0}
        avgPaymentDays={stats?.avgPaymentDays || 0}
        isLoading={statsLoading}
      />

      {/* Filters */}
      <InvoiceFilters filters={filters} onFiltersChange={setFilters} />

      {/* Table */}
      <InvoicesTable
        invoices={invoices}
        isLoading={isLoading}
        selectedIds={selectedIds}
        onSelectChange={setSelectedIds}
        onView={handleView}
        onSend={handleSend}
        onMarkPaid={handleMarkPaid}
        onDelete={handleDelete}
        onBulkSend={handleBulkSend}
        onBulkMarkPaid={handleBulkMarkPaid}
        onBulkDelete={handleBulkDelete}
      />

      {/* Create Invoice Modal */}
      {userId && (
        <CreateInvoiceModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          userId={userId}
        />
      )}

      {/* Create Payment Plan Modal */}
      {userId && (
        <CreatePaymentPlanModal
          isOpen={paymentPlanModalOpen}
          onClose={() => setPaymentPlanModalOpen(false)}
          userId={userId}
        />
      )}

      {/* Invoice Detail Sheet */}
      <InvoiceDetailSheet
        invoiceId={selectedInvoice?.id || null}
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />
    </div>
  )
}
