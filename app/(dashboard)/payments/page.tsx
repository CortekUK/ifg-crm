'use client'

import { useState, useMemo } from 'react'
import { PaymentsPageHeader } from '@/components/payments/PaymentsPageHeader'
import { PaymentStats } from '@/components/payments/PaymentStats'
import { PaymentFilters } from '@/components/payments/PaymentFilters'
import { PaymentsTable } from '@/components/payments/PaymentsTable'
import { PaymentDetailSheet } from '@/components/payments/PaymentDetailSheet'
import { RecordPaymentModal } from '@/components/payments/RecordPaymentModal'
import { InvoiceDetailSheet } from '@/components/invoices/InvoiceDetailSheet'
import { usePayments, usePaymentStats } from '@/lib/hooks/usePayments'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import type { PaymentFilters as Filters, Payment } from '@/lib/types/payments'

export default function PaymentsPage() {
  const [filters, setFilters] = useState<Filters>({
    search: '',
    paymentMethod: 'all',
    status: 'all',
    dateFrom: null,
    dateTo: null,
  })
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false)

  const { data: payments = [], isLoading: paymentsLoading } = usePayments()
  const { data: stats, isLoading: statsLoading } = usePaymentStats()
  const { data: currentUser } = useCurrentUser()

  // Filter payments
  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const contactName = payment.contact
          ? `${payment.contact.first_name} ${payment.contact.last_name}`.toLowerCase()
          : ''
        const reference = payment.reference?.toLowerCase() || ''

        if (!contactName.includes(searchLower) && !reference.includes(searchLower)) {
          return false
        }
      }

      // Method filter
      if (filters.paymentMethod !== 'all' && payment.payment_method !== filters.paymentMethod) {
        return false
      }

      // Status filter
      if (filters.status !== 'all' && payment.status !== filters.status) {
        return false
      }

      // Pipeline filter
      if (filters.pipelineId) {
        const paymentPipelineId = payment.invoice?.deal?.pipeline_id
        if (paymentPipelineId !== filters.pipelineId) {
          return false
        }
      }

      // Date filters
      const paymentDate = new Date(payment.created_at)
      if (filters.dateFrom && paymentDate < filters.dateFrom) {
        return false
      }
      if (filters.dateTo && paymentDate > filters.dateTo) {
        return false
      }

      return true
    })
  }, [payments, filters])

  const handleExport = () => {
    if (filteredPayments.length === 0) return

    const headers = ['Date', 'Contact', 'Invoice #', 'Amount', 'Method', 'Reference', 'Status']
    const rows = filteredPayments.map((p) => [
      new Date(p.created_at).toLocaleDateString('en-GB'),
      p.contact ? `${p.contact.first_name} ${p.contact.last_name}` : 'Unknown',
      p.invoice?.invoice_number || '',
      p.amount.toFixed(2),
      p.payment_method,
      p.reference || '',
      p.status,
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `payments-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleViewPayment = (payment: Payment) => {
    setSelectedPayment(payment)
  }

  const handleViewInvoice = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PaymentsPageHeader
        onExport={handleExport}
        onRecordPayment={() => setRecordPaymentOpen(true)}
      />

      {/* Stats Cards */}
      <PaymentStats
        totalReceived={stats?.totalReceived || 0}
        pending={stats?.pending || 0}
        failedCount={stats?.failedCount || 0}
        avgTransaction={stats?.avgTransaction || 0}
        isLoading={statsLoading}
      />

      {/* Filters */}
      <PaymentFilters filters={filters} onFiltersChange={setFilters} />

      {/* Payments Table */}
      <PaymentsTable
        payments={filteredPayments}
        isLoading={paymentsLoading}
        onView={handleViewPayment}
        onViewInvoice={handleViewInvoice}
      />

      {/* Payment Detail Sheet */}
      <PaymentDetailSheet
        payment={selectedPayment}
        isOpen={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
        onViewInvoice={(invoiceId) => {
          setSelectedPayment(null)
          setSelectedInvoiceId(invoiceId)
        }}
      />

      {/* Invoice Detail Sheet */}
      <InvoiceDetailSheet
        invoiceId={selectedInvoiceId}
        isOpen={!!selectedInvoiceId}
        onClose={() => setSelectedInvoiceId(null)}
      />

      {/* Record Payment Modal */}
      {currentUser?.id && (
        <RecordPaymentModal
          isOpen={recordPaymentOpen}
          onClose={() => setRecordPaymentOpen(false)}
          userId={currentUser.id}
        />
      )}
    </div>
  )
}
