'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Eye,
  CreditCard,
  Building2,
  Banknote,
  Globe,
  CircleDot,
  Receipt,
} from 'lucide-react'
import type { Payment } from '@/lib/types/payments'

interface PaymentsTableProps {
  payments: Payment[]
  isLoading: boolean
  onView?: (payment: Payment) => void
  onViewInvoice?: (invoiceId: string) => void
  hasActiveFilters?: boolean
}

const methodConfig: Record<string, { label: string; icon: React.ElementType }> = {
  stripe: { label: 'Stripe', icon: CreditCard },
  bank_transfer: { label: 'Bank Transfer', icon: Building2 },
  cash: { label: 'Cash', icon: Banknote },
  website: { label: 'Website', icon: Globe },
  other: { label: 'Other', icon: CircleDot },
}

const statusConfig: Record<string, { label: string; className: string }> = {
  successful: { label: 'Successful', className: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' },
  pending: { label: 'Pending', className: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' },
  failed: { label: 'Failed', className: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' },
}

const defaultMethod = { label: 'Other', icon: CircleDot }
const defaultStatus = { label: 'Unknown', className: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' }

export function PaymentsTable({
  payments,
  isLoading,
  onView,
  onViewInvoice,
  hasActiveFilters,
}: PaymentsTableProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount)
  }

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '??'
  }

  if (isLoading) {
    return (
      <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-8 w-36" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (payments.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center bg-white dark:bg-slate-900 dark:border-slate-700">
        <Receipt className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
          {hasActiveFilters ? 'No payments match your filters' : 'No payments yet'}
        </h3>
        <p className="text-muted-foreground">
          {hasActiveFilters
            ? 'Try adjusting your search or filters.'
            : 'Payments will appear here once recorded.'}
        </p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Invoice #</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => {
            const method = methodConfig[payment.payment_method] || defaultMethod
            const status = statusConfig[payment.status] || defaultStatus
            const MethodIcon = method.icon

            return (
              <TableRow key={payment.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onView?.(payment)}>
                {/* Date */}
                <TableCell className="text-sm">
                  {formatDate(payment.created_at)}
                </TableCell>

                {/* Contact */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs">
                        {getInitials(
                          payment.contact?.first_name,
                          payment.contact?.last_name
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">
                      {payment.contact
                        ? `${payment.contact.first_name} ${payment.contact.last_name}`
                        : 'Unknown'}
                    </span>
                  </div>
                </TableCell>

                {/* Invoice # */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {payment.invoice ? (
                    <button
                      onClick={() => onViewInvoice?.(payment.invoice!.id)}
                      className="text-blue-600 hover:underline text-sm text-left"
                    >
                      {payment.invoice.invoice_number}
                    </button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* Amount */}
                <TableCell className="font-medium">
                  {formatCurrency(payment.amount)}
                </TableCell>

                {/* Method */}
                <TableCell>
                  <div className="flex items-center gap-1.5 text-sm">
                    <MethodIcon className="h-4 w-4 text-muted-foreground" />
                    {method.label}
                  </div>
                </TableCell>

                {/* Reference */}
                <TableCell className="text-sm text-muted-foreground font-mono">
                  {payment.reference || '—'}
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Badge className={status.className}>{status.label}</Badge>
                </TableCell>

                {/* Actions */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" onClick={() => onView?.(payment)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
