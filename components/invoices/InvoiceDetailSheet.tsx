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
import { Separator } from '@/components/ui/separator'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Send,
  Bell,
  CheckCircle,
  Download,
  Mail,
  Phone,
  Calendar,
  FileText,
} from 'lucide-react'
import { formatCurrency, formatDate, formatDateLong } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { useInvoice, useUpdateInvoiceStatus } from '@/lib/hooks/useInvoices'
import type { InvoiceStatus, InvoiceType } from '@/lib/types/invoices'

interface InvoiceDetailSheetProps {
  invoiceId: string | null
  isOpen: boolean
  onClose: () => void
}

const statusConfig: Record<InvoiceStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  sent: { label: 'Sent', className: 'bg-blue-100 text-blue-700' },
  viewed: { label: 'Viewed', className: 'bg-purple-100 text-purple-700' },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-700' },
  overdue: { label: 'Overdue', className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500' },
}

const typeLabels: Record<InvoiceType, string> = {
  deposit: 'Deposit',
  installment: 'Instalment',
  full_payment: 'Full Payment',
  meal_plan: 'Meal Plan',
  trip: 'Trip',
  other: 'Other',
}

export function InvoiceDetailSheet({
  invoiceId,
  isOpen,
  onClose,
}: InvoiceDetailSheetProps) {
  const { data: invoice, isLoading } = useInvoice(invoiceId)
  const updateStatus = useUpdateInvoiceStatus()

  const handleSend = async () => {
    if (!invoiceId) return
    await updateStatus.mutateAsync({ invoiceId, status: 'sent' })
  }

  const handleMarkPaid = async () => {
    if (!invoiceId) return
    await updateStatus.mutateAsync({ invoiceId, status: 'paid' })
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
      <SheetContent className="sm:max-w-lg">
        {isLoading || !invoice ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-center justify-between">
                <SheetTitle className="text-blue-600">
                  {invoice.invoice_number}
                </SheetTitle>
                <Badge className={statusConfig[invoice.status].className}>
                  {statusConfig[invoice.status].label}
                </Badge>
              </div>
              <SheetDescription>
                {typeLabels[invoice.type]} - {invoice.description}
              </SheetDescription>
            </SheetHeader>

            <ScrollArea className="h-[calc(100vh-260px)] pr-4">
              <div className="space-y-6 mt-6">
                {/* Amount */}
                <div className="text-center py-6 bg-gray-50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Amount Due</p>
                  <p className="text-4xl font-bold text-gray-900">
                    {formatCurrency(invoice.amount)}
                  </p>
                </div>

                {/* Contact Info */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-blue-100 text-blue-600">
                          {getInitials(
                            invoice.contact?.first_name,
                            invoice.contact?.last_name
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">
                          {invoice.contact
                            ? `${invoice.contact.first_name} ${invoice.contact.last_name}`
                            : 'Unknown Contact'}
                        </p>
                        {invoice.contact?.email && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Mail className="h-3 w-3" />
                            {invoice.contact.email}
                          </div>
                        )}
                        {invoice.contact?.phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Phone className="h-3 w-3" />
                            {invoice.contact.phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Calendar className="h-4 w-4" />
                        <span className="text-xs">Due Date</span>
                      </div>
                      <p
                        className={cn(
                          'font-medium',
                          isOverdue(invoice.due_date, invoice.status) &&
                            'text-red-600'
                        )}
                      >
                        {formatDateLong(invoice.due_date)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Send className="h-4 w-4" />
                        <span className="text-xs">Sent Date</span>
                      </div>
                      <p className="font-medium">
                        {invoice.sent_at ? formatDateLong(invoice.sent_at) : '—'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Programme / Deal */}
                {invoice.deal && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm">Linked Deal</span>
                      </div>
                      <p className="font-medium">{invoice.deal.title}</p>
                      {invoice.deal.pipeline && (
                        <Badge variant="outline" className="mt-2">
                          {invoice.deal.pipeline.name}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Description */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Description</h4>
                  <p className="text-sm text-muted-foreground">
                    {invoice.description}
                  </p>
                </div>

                {/* Notes */}
                {invoice.notes && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-700">Notes</h4>
                    <p className="text-sm text-muted-foreground">{invoice.notes}</p>
                  </div>
                )}

                {/* Payment History */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">
                    Payment History
                  </h4>
                  {invoice.paid_at ? (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 rounded-full">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">Payment Received</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateLong(invoice.paid_at)}
                            </p>
                          </div>
                          <p className="font-medium text-green-600">
                            {formatCurrency(invoice.amount)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No payments recorded yet.
                    </p>
                  )}
                </div>
              </div>
            </ScrollArea>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-6 border-t mt-6">
              {invoice.status === 'draft' && (
                <Button
                  onClick={handleSend}
                  disabled={updateStatus.isPending}
                  className="flex-1"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Invoice
                </Button>
              )}

              {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleSend}
                    disabled={updateStatus.isPending}
                    className="flex-1"
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    Send Reminder
                  </Button>
                  <Button
                    onClick={handleMarkPaid}
                    disabled={updateStatus.isPending}
                    className="flex-1"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Paid
                  </Button>
                </>
              )}

              <Button variant="outline" disabled className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
