'use client'

import { useState, useEffect } from 'react'
import { InvoicesPageHeader } from '@/components/invoices/InvoicesPageHeader'
import { InvoiceStats } from '@/components/invoices/InvoiceStats'
import { InvoiceFilters } from '@/components/invoices/InvoiceFilters'
import { InvoicesTable } from '@/components/invoices/InvoicesTable'
import { CreateInvoiceModal } from '@/components/invoices/CreateInvoiceModal'
import { InvoiceDetailSheet } from '@/components/invoices/InvoiceDetailSheet'
import {
  useInvoices,
  useInvoiceStats,
  useUpdateInvoiceStatus,
  useDeleteInvoice,
} from '@/lib/hooks/useInvoices'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { createClient } from '@/lib/supabase/client'
import type { InvoiceFilters as InvoiceFiltersType, Invoice } from '@/lib/types/invoices'

export default function InvoicesPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [filters, setFilters] = useState<InvoiceFiltersType>({})
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [createModalOpen, setCreateModalOpen] = useState(false)
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <InvoicesPageHeader onCreateClick={() => setCreateModalOpen(true)} />

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
      />

      {/* Create Invoice Modal */}
      {userId && (
        <CreateInvoiceModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
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
