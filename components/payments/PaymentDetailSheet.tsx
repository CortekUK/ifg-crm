'use client'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  CreditCard,
  Building2,
  Banknote,
  Globe,
  CircleDot,
  Mail,
  Phone,
  Receipt,
  FileText,
  User,
  Calendar,
  Hash,
} from 'lucide-react'
import { formatCurrency, formatDateLong } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { Payment } from '@/lib/types/payments'

interface PaymentDetailSheetProps {
  payment: Payment | null
  isOpen: boolean
  onClose: () => void
  onViewInvoice?: (invoiceId: string) => void
}

const methodConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  stripe: { label: 'Stripe', icon: CreditCard, color: 'bg-purple-100 text-purple-600' },
  bank_transfer: { label: 'Bank Transfer', icon: Building2, color: 'bg-blue-100 text-blue-600' },
  cash: { label: 'Cash', icon: Banknote, color: 'bg-green-100 text-green-600' },
  website: { label: 'Website', icon: Globe, color: 'bg-cyan-100 text-cyan-600' },
  other: { label: 'Other', icon: CircleDot, color: 'bg-gray-100 text-gray-600' },
}

const statusConfig: Record<string, { label: string; className: string }> = {
  successful: { label: 'Successful', className: 'bg-green-100 dark:bg-green-900/50 text-green-700' },
  pending: { label: 'Pending', className: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700' },
  failed: { label: 'Failed', className: 'bg-red-100 dark:bg-red-900/50 text-red-700' },
}

const defaultMethod = { label: 'Other', icon: CircleDot, color: 'bg-gray-100 text-gray-600' }
const defaultStatus = { label: 'Unknown', className: 'bg-gray-100 dark:bg-gray-800 text-gray-700' }

export function PaymentDetailSheet({
  payment,
  isOpen,
  onClose,
  onViewInvoice,
}: PaymentDetailSheetProps) {
  if (!payment) return null

  const method = methodConfig[payment.payment_method] || defaultMethod
  const status = statusConfig[payment.status] || defaultStatus
  const MethodIcon = method.icon

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.[0] || ''
    const last = lastName?.[0] || ''
    return (first + last).toUpperCase() || '??'
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col p-0 gap-0">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-green-600 text-white text-lg font-semibold">
                {getInitials(payment.contact?.first_name, payment.contact?.last_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
                Payment Received
              </SheetTitle>
              <SheetDescription className="mt-1">
                {payment.contact
                  ? `${payment.contact.first_name} ${payment.contact.last_name}`
                  : 'Unknown Contact'}
              </SheetDescription>
              <Badge className={cn('mt-2', status.className)}>
                {status.label}
              </Badge>
            </div>
          </div>

          {/* Amount Display */}
          <div className="text-center py-4 bg-green-50 dark:bg-green-900/20 rounded-lg mt-4 border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-600 dark:text-green-400 mb-1">Amount Received</p>
            <p className="text-3xl font-bold text-green-700 dark:text-green-300">
              {formatCurrency(payment.amount)}
            </p>
          </div>
        </SheetHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Payment Method */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
              Payment Method
            </h3>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border">
              <div className={cn('p-2 rounded-full', method.color)}>
                <MethodIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{method.label}</p>
                {payment.reference && (
                  <p className="text-sm text-muted-foreground font-mono">{payment.reference}</p>
                )}
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
              Contact Information
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {payment.contact
                    ? `${payment.contact.first_name} ${payment.contact.last_name}`
                    : 'Unknown Contact'}
                </span>
              </div>
              {payment.contact?.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`mailto:${payment.contact.email}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {payment.contact.email}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Payment Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
              Payment Details
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Date
                </div>
                <span className="text-sm font-medium">{formatDateTime(payment.created_at)}</span>
              </div>
              {payment.reference && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Hash className="h-4 w-4" />
                    Reference
                  </div>
                  <span className="text-sm font-medium font-mono">{payment.reference}</span>
                </div>
              )}
              {payment.recorded_by && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    Recorded By
                  </div>
                  <span className="text-sm font-medium">
                    {payment.recorded_by.full_name || 'Unknown'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Linked Invoice */}
          {payment.invoice && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Linked Invoice
              </h3>
              <div
                className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                onClick={() => onViewInvoice?.(payment.invoice!.id)}
              >
                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                  <Receipt className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    {payment.invoice.invoice_number}
                  </p>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                    Click to view invoice details
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {payment.notes && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Notes
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">{payment.notes}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
