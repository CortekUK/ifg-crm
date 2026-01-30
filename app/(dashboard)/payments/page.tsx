'use client'

import { useState, useMemo } from 'react'
import { PaymentsPageHeader } from '@/components/payments/PaymentsPageHeader'
import { PaymentStats } from '@/components/payments/PaymentStats'
import { PaymentFilters } from '@/components/payments/PaymentFilters'
import { PaymentsTable } from '@/components/payments/PaymentsTable'
import { usePayments, usePaymentStats } from '@/lib/hooks/usePayments'
import type { PaymentFilters as Filters, Payment } from '@/lib/types/payments'

export default function PaymentsPage() {
  const [filters, setFilters] = useState<Filters>({
    search: '',
    paymentMethod: 'all',
    status: 'all',
    dateFrom: null,
    dateTo: null,
  })

  const { data: payments = [], isLoading: paymentsLoading } = usePayments()
  const { data: stats, isLoading: statsLoading } = usePaymentStats()

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
    console.log('Exporting payments...')
  }

  const handleViewPayment = (payment: Payment) => {
    console.log('View payment:', payment)
  }

  const handleRefundPayment = (payment: Payment) => {
    if (confirm(`Are you sure you want to refund ${payment.amount}?`)) {
      console.log('Refund payment:', payment)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PaymentsPageHeader onExport={handleExport} />

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
        onRefund={handleRefundPayment}
      />
    </div>
  )
}
