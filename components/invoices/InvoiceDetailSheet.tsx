'use client'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Send,
  Bell,
  CheckCircle,
  Download,
  Mail,
  Phone,
  Copy,
  Pencil,
  Ban,
  Link,
  CreditCard,
  ExternalLink,
} from 'lucide-react'
import { toast } from '@/lib/hooks/use-toast'
import { formatCurrency, formatDateLong } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { useInvoice, useUpdateInvoiceStatus } from '@/lib/hooks/useInvoices'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { RecordPaymentModal } from '@/components/payments/RecordPaymentModal'
import { useState } from 'react'
import { generateInvoicePDF } from '@/lib/utils/generateInvoicePDF'
import type { InvoiceStatus, InvoiceType } from '@/lib/types/invoices'

interface InvoiceDetailSheetProps {
  invoiceId: string | null
  isOpen: boolean
  onClose: () => void
}

const statusConfig: Record<InvoiceStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 dark:bg-gray-800 text-gray-700' },
  sent: { label: 'Sent', className: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700' },
  viewed: { label: 'Viewed', className: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700' },
  paid: { label: 'Paid', className: 'bg-green-100 dark:bg-green-900/50 text-green-700' },
  overdue: { label: 'Overdue', className: 'bg-red-100 dark:bg-red-900/50 text-red-700' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 dark:bg-gray-800 text-gray-500' },
}

const typeLabels: Record<InvoiceType, string> = {
  deposit: 'Deposit',
  installment: 'Instalment',
  full_payment: 'Full Payment',
  meal_plan: 'Meal Plan',
  trip: 'Trip',
  other: 'Other',
}

export function InvoiceDetailSheet({ invoiceId, isOpen, onClose }: InvoiceDetailSheetProps) {
  const { data: invoice, isLoading } = useInvoice(invoiceId)
  const updateStatus = useUpdateInvoiceStatus()
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false)
  const supabase = createClient()

  // Fetch payment history for this invoice
  const { data: paymentHistory = [] } = useQuery({
    queryKey: ['invoice-payments', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return []
      const { data } = await supabase
        .from('payments')
        .select('id, amount, payment_date, payment_method, reference, notes')
        .eq('invoice_id', invoiceId)
        .order('payment_date', { ascending: false })
      return data || []
    },
    enabled: !!invoiceId && isOpen,
  })

  const handleSend = async () => {
    if (!invoiceId) return
    try {
      // Send invoice with payment link email
      const res = await fetch(`/api/invoices/${invoiceId}/send-with-link`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) {
        // Fallback to just marking as sent if email fails
        await updateStatus.mutateAsync({ invoiceId, status: 'sent' })
        toast({
          title: 'Invoice marked as sent',
          description: data.error || 'Email could not be sent but invoice status updated.',
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Invoice sent',
        description: data.message || 'Invoice sent with payment link.',
      })
    } catch {
      toast({
        title: 'Failed to send invoice',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleMarkPaid = async () => {
    if (!invoiceId) return
    try {
      await updateStatus.mutateAsync({ invoiceId, status: 'paid' })
      toast({
        title: 'Payment recorded',
        description: 'The invoice has been marked as paid.',
      })
    } catch {
      toast({
        title: 'Failed to record payment',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleVoid = async () => {
    if (!invoiceId) return
    try {
      await updateStatus.mutateAsync({ invoiceId, status: 'cancelled' })
      toast({
        title: 'Invoice cancelled',
        description: 'The invoice has been marked as cancelled.',
      })
    } catch {
      toast({
        title: 'Failed to cancel invoice',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleDownloadPDF = () => {
    if (!invoice) return
    generateInvoicePDF(invoice)
  }

  const handleCopyPaymentLink = () => {
    if (!invoice) return
    // Generate Stripe payment link (in production this would be the actual Stripe checkout URL)
    const paymentLink = `${window.location.origin}/pay/${invoice.id}`
    navigator.clipboard.writeText(paymentLink)
    toast({
      title: 'Payment link copied',
      description: 'The payment link has been copied to your clipboard.',
    })
  }

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.[0] || ''
    const last = lastName?.[0] || ''
    return (first + last).toUpperCase() || '??'
  }

  const isOverdue = (dueDate: string, status: InvoiceStatus) => {
    if (status === 'paid' || status === 'cancelled') return false
    return new Date(dueDate) < new Date()
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col p-0 gap-0">
        {isLoading || !invoice ? (
          <div className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-blue-600 text-white text-lg font-semibold">
                    {getInitials(invoice.contact?.first_name, invoice.contact?.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
                    {invoice.invoice_number}
                  </SheetTitle>
                  <SheetDescription className="mt-1">
                    {typeLabels[invoice.type]} - {invoice.description}
                  </SheetDescription>
                  <Badge className={cn('mt-2', statusConfig[invoice.status].className)}>
                    {statusConfig[invoice.status].label}
                  </Badge>
                </div>
              </div>

              {/* Amount Display */}
              <div className="text-center py-4 bg-slate-50 dark:bg-slate-800 rounded-lg mt-4">
                <p className="text-sm text-slate-500 mb-1">Amount Due</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(invoice.amount)}</p>
              </div>
            </SheetHeader>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                  Contact Information
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Name</span>
                    <span className="text-sm font-medium">
                      {invoice.contact ? `${invoice.contact.first_name} ${invoice.contact.last_name}` : 'Unknown Contact'}
                    </span>
                  </div>
                  {invoice.contact?.email && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Email</span>
                      <a href={`mailto:${invoice.contact.email}`} className="text-sm font-medium text-blue-600 hover:underline">
                        {invoice.contact.email}
                      </a>
                    </div>
                  )}
                  {invoice.contact?.phone && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Phone</span>
                      <span className="text-sm font-medium">{invoice.contact.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Invoice Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                  Invoice Details
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Due Date</span>
                    <span className={cn('text-sm font-medium', isOverdue(invoice.due_date, invoice.status) && 'text-red-600')}>
                      {formatDateLong(invoice.due_date)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Sent Date</span>
                    <span className="text-sm font-medium">{invoice.sent_at ? formatDateLong(invoice.sent_at) : 'Not sent'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Type</span>
                    <span className="text-sm font-medium">{typeLabels[invoice.type]}</span>
                  </div>
                </div>
              </div>

              {/* Linked Deal */}
              {invoice.deal && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                    Linked Deal
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Deal</span>
                      <span className="text-sm font-medium">{invoice.deal.title}</span>
                    </div>
                    {invoice.deal.pipeline && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Pipeline</span>
                        <span className="text-sm font-medium">{invoice.deal.pipeline.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                  Description
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">{invoice.description}</p>
              </div>

              {/* Notes */}
              {invoice.notes && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                    Notes
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{invoice.notes}</p>
                </div>
              )}

              {/* Payment History */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                  Payment History
                </h3>
                {paymentHistory.length > 0 ? (
                  <div className="space-y-2">
                    {paymentHistory.map((pmt) => (
                      <div key={pmt.id} className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                        <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-full">
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-900 dark:text-green-200 capitalize">
                            {pmt.payment_method?.replace('_', ' ') || 'Payment'}
                          </p>
                          <p className="text-xs text-green-700 dark:text-green-300">{formatDateLong(pmt.payment_date)}</p>
                          {pmt.reference && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Ref: {pmt.reference}</p>
                          )}
                        </div>
                        <p className="font-semibold text-green-600">{formatCurrency(pmt.amount)}</p>
                      </div>
                    ))}
                  </div>
                ) : invoice.status === 'paid' && invoice.paid_at ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                    <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-full">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900 dark:text-green-200 capitalize">
                        {invoice.payment_method?.replace('_', ' ') || 'Payment'}
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-300">{formatDateLong(invoice.paid_at)}</p>
                    </div>
                    <p className="font-semibold text-green-600">{formatCurrency(invoice.amount)}</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">No payments recorded yet.</p>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <SheetFooter className="border-t px-6 py-4 bg-slate-50 dark:bg-slate-800 shrink-0">
              <div className="space-y-3 w-full">
                {/* Primary Actions */}
                <div className="flex flex-wrap gap-2">
                  {invoice.status === 'draft' && (
                    <>
                      <Button onClick={handleSend} disabled={updateStatus.isPending} className="flex-1 bg-blue-600 hover:bg-blue-700">
                        <Send className="h-4 w-4 mr-2" />
                        Send Invoice
                      </Button>
                      <Button variant="outline" onClick={handleVoid} disabled={updateStatus.isPending}>
                        <Ban className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </>
                  )}

                  {(invoice.status === 'sent' || invoice.status === 'overdue') && paymentHistory.length === 0 && (
                    <>
                      <Button variant="outline" onClick={handleSend} disabled={updateStatus.isPending} className="flex-1">
                        <Bell className="h-4 w-4 mr-2" />
                        Send Reminder
                      </Button>
                      <Button onClick={() => setRecordPaymentOpen(true)} className="flex-1 bg-green-600 hover:bg-green-700">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Record Payment
                      </Button>
                    </>
                  )}

                  {invoice.status !== 'draft' && (
                    <Button variant="outline" className="flex-1" onClick={handleDownloadPDF}>
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>
                  )}
                </div>

                {/* Secondary Actions */}
                {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" size="sm" onClick={handleCopyPaymentLink}>
                      <Link className="h-4 w-4 mr-2" />
                      Copy Payment Link
                    </Button>
                    {invoice.status !== 'draft' && (
                      <Button variant="ghost" size="sm" onClick={handleVoid} disabled={updateStatus.isPending} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                        <Ban className="h-4 w-4 mr-2" />
                        Void Invoice
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>

      {/* Record Payment Modal */}
      {invoice && (
        <RecordPaymentModal
          isOpen={recordPaymentOpen}
          onClose={() => setRecordPaymentOpen(false)}
          preselectedContactId={invoice.contact_id}
          preselectedInvoiceId={invoice.id}
        />
      )}
    </Sheet>
  )
}
