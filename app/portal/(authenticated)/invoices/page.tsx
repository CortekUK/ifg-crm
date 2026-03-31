'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  ReceiptPoundSterling,
  CreditCard,
  Loader2,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  X,
  FileText,
  Calendar,
} from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import { toast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'

interface Invoice {
  id: string
  invoice_number: string
  description: string
  amount: number
  currency: string
  status: string
  type: string
  due_date: string
  paid_at: string | null
  sent_at: string | null
  payment_method: string | null
  notes: string | null
  created_at: string
  programme_name: string | null
}

interface Payment {
  id: string
  amount: number
  payment_date: string
  payment_method: string
  reference: string | null
}

function getPlayerStatus(status: string): { label: string; className: string; icon: typeof CheckCircle2 } {
  switch (status) {
    case 'paid':
      return { label: 'Paid', className: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300', icon: CheckCircle2 }
    case 'overdue':
      return { label: 'Overdue', className: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300', icon: AlertTriangle }
    case 'cancelled':
      return { label: 'Cancelled', className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400', icon: X }
    default:
      return { label: 'Unpaid', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300', icon: Clock }
  }
}

const formatCurrency = (amount: number, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount)

const typeLabels: Record<string, string> = {
  deposit: 'Deposit',
  installment: 'Installment',
  full_payment: 'Full Payment',
  meal_plan: 'Meal Plan',
  trip: 'Trip',
  other: 'Other',
}

export default function PortalInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('all')
  const [search, setSearch] = useState('')
  const [payingId, setPayingId] = useState<string | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [contactId, setContactId] = useState<string | null>(null)

  useEffect(() => {
    const fetchInvoices = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('contact_id')
        .eq('id', user.id)
        .single()

      if (!profile?.contact_id) return
      setContactId(profile.contact_id)

      const { data } = await supabase
        .from('invoices')
        .select('id, invoice_number, description, amount, currency, status, type, due_date, paid_at, sent_at, payment_method, notes, created_at, deal:deals(pipeline:pipelines(name))')
        .eq('contact_id', profile.contact_id)
        .order('created_at', { ascending: false })

      setInvoices((data || []).map((inv) => {
        const deal = inv.deal as unknown as { pipeline: { name: string } | null } | null
        return {
          ...inv,
          programme_name: deal?.pipeline?.name || null,
          deal: undefined,
        } as Invoice
      }))
      setLoading(false)
    }

    fetchInvoices()
  }, [])

  const openInvoice = useCallback(async (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setPaymentsLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('payments')
      .select('id, amount, payment_date, payment_method, reference')
      .eq('invoice_id', invoice.id)
      .order('payment_date', { ascending: false })
    setPayments(data || [])
    setPaymentsLoading(false)
  }, [])

  const handlePay = async (invoiceId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setPayingId(invoiceId)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to start payment', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to start payment', variant: 'destructive' })
    }
    setPayingId(null)
  }

  const handleDownload = async (invoice: Invoice) => {
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    // Header background
    doc.setFillColor(30, 64, 175)
    doc.rect(0, 0, pageWidth, 45, 'F')

    // Header text
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text('INVOICE', 20, 25)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text('The International Football Group', 20, 35)

    // Invoice number & status
    doc.setTextColor(30, 64, 175)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(invoice.invoice_number, 20, 62)

    const statusLabel = getPlayerStatus(invoice.status).label
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(`Status: ${statusLabel}`, pageWidth - 20, 62, { align: 'right' })

    // Divider
    doc.setDrawColor(226, 232, 240)
    doc.line(20, 68, pageWidth - 20, 68)

    // Details
    let y = 80
    const addRow = (label: string, value: string) => {
      doc.setTextColor(100, 116, 139)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(label, 20, y)
      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.text(value, pageWidth - 20, y, { align: 'right' })
      y += 12
    }

    addRow('Description', invoice.description || '-')
    addRow('Type', typeLabels[invoice.type] || invoice.type)
    addRow('Issue Date', formatDate(invoice.created_at))
    addRow('Due Date', formatDate(invoice.due_date))
    if (invoice.paid_at) addRow('Paid On', formatDate(invoice.paid_at))

    // Notes
    if (invoice.notes) {
      y += 4
      doc.setTextColor(100, 116, 139)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('Notes:', 20, y)
      y += 8
      doc.setTextColor(15, 23, 42)
      const lines = doc.splitTextToSize(invoice.notes, pageWidth - 40)
      doc.text(lines, 20, y)
      y += lines.length * 6
    }

    // Total section
    y += 10
    doc.setDrawColor(226, 232, 240)
    doc.line(20, y, pageWidth - 20, y)
    y += 15

    doc.setTextColor(100, 116, 139)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text('Total Amount', 20, y)
    doc.setTextColor(30, 64, 175)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text(formatCurrency(invoice.amount, invoice.currency), pageWidth - 20, y, { align: 'right' })

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 20
    doc.setDrawColor(226, 232, 240)
    doc.line(20, footerY - 10, pageWidth - 20, footerY - 10)
    doc.setTextColor(148, 163, 184)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('The International Football Group | info@theinternationalfootballgroup.com', pageWidth / 2, footerY, { align: 'center' })

    doc.save(`${invoice.invoice_number}.pdf`)
  }

  // Stats
  const unpaidInvoices = invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
  const paidInvoices = invoices.filter((i) => i.status === 'paid')
  const totalOutstanding = unpaidInvoices.reduce((sum, i) => sum + Number(i.amount), 0)
  const totalPaid = paidInvoices.reduce((sum, i) => sum + Number(i.amount), 0)

  const filtered = invoices.filter((inv) => {
    if (filter === 'unpaid' && (inv.status === 'paid' || inv.status === 'cancelled')) return false
    if (filter === 'paid' && inv.status !== 'paid') return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return inv.invoice_number.toLowerCase().includes(q) ||
        inv.description.toLowerCase().includes(q) ||
        inv.amount.toString().includes(q)
    }
    return true
  })

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Invoices</h1>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">Outstanding</span>
              <Clock className="h-3.5 w-3.5 text-orange-500" />
            </div>
            <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatCurrency(totalOutstanding)}</p>
            <p className="text-[10px] text-slate-400">{unpaidInvoices.length} invoice{unpaidInvoices.length !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">Total Paid</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            </div>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(totalPaid)}</p>
            <p className="text-[10px] text-slate-400">{paidInvoices.length} invoice{paidInvoices.length !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900 col-span-2 md:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">Total Invoices</span>
              <ReceiptPoundSterling className="h-3.5 w-3.5 text-blue-500" />
            </div>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{invoices.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by invoice number, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'unpaid', 'paid'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className={cn(
                'text-xs',
                filter === f ? 'bg-blue-600 hover:bg-blue-700' : ''
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'unpaid' && unpaidInvoices.length > 0 && (
                <span className="ml-1 bg-white/20 rounded-full px-1.5 text-[10px]">{unpaidInvoices.length}</span>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Invoice List */}
      {filtered.length === 0 ? (
        <Card className="bg-white dark:bg-slate-900">
          <CardContent className="p-12 text-center">
            <ReceiptPoundSterling className="h-12 w-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <h3 className="font-medium text-slate-900 dark:text-white mb-1">No invoices found</h3>
            <p className="text-sm text-slate-400">
              {search ? 'Try a different search term.' : 'Invoices will appear here when created.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((invoice) => {
            const status = getPlayerStatus(invoice.status)
            const StatusIcon = status.icon
            const canPay = invoice.status !== 'paid' && invoice.status !== 'cancelled' && invoice.status !== 'draft'

            return (
              <Card
                key={invoice.id}
                className="bg-white dark:bg-slate-900 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => openInvoice(invoice)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Status Icon */}
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                      invoice.status === 'paid' && 'bg-green-100 dark:bg-green-900/30',
                      invoice.status === 'overdue' && 'bg-red-100 dark:bg-red-900/30',
                      !['paid', 'overdue', 'cancelled'].includes(invoice.status) && 'bg-orange-100 dark:bg-orange-900/30',
                      invoice.status === 'cancelled' && 'bg-slate-100 dark:bg-slate-800',
                    )}>
                      <StatusIcon className={cn(
                        'h-5 w-5',
                        invoice.status === 'paid' && 'text-green-600 dark:text-green-400',
                        invoice.status === 'overdue' && 'text-red-500',
                        !['paid', 'overdue', 'cancelled'].includes(invoice.status) && 'text-orange-500',
                        invoice.status === 'cancelled' && 'text-slate-400',
                      )} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{invoice.invoice_number}</span>
                        <Badge className={cn(status.className, 'text-[10px] px-1.5 py-0')} variant="secondary">
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{invoice.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {invoice.programme_name && (
                          <span className="text-[10px] text-blue-500 dark:text-blue-400 font-medium">{invoice.programme_name}</span>
                        )}
                        <span className="text-[10px] text-slate-400">Due {formatDate(invoice.due_date)}</span>
                      </div>
                    </div>

                    {/* Amount + Action */}
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-slate-900 dark:text-white">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </p>
                      {canPay && (
                        <Button
                          size="sm"
                          className="mt-1.5 h-7 text-xs bg-blue-600 hover:bg-blue-700"
                          disabled={payingId === invoice.id}
                          onClick={(e) => handlePay(invoice.id, e)}
                        >
                          {payingId === invoice.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            'Pay Now'
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Invoice Detail Sheet */}
      <Sheet open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
          {selectedInvoice && (() => {
            const inv = selectedInvoice
            const status = getPlayerStatus(inv.status)
            const canPay = inv.status !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'draft'

            return (
              <>
                <SheetHeader className="px-6 pt-6 pb-4">
                  <div className="flex items-center justify-between">
                    <SheetTitle className="text-xl font-bold">{inv.invoice_number}</SheetTitle>
                    <Badge className={cn(status.className, 'text-xs')} variant="secondary">
                      {status.label}
                    </Badge>
                  </div>
                </SheetHeader>

                <div className="px-6 pb-6 space-y-6">

                {/* Amount Banner */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Amount Due</p>
                  <p className={cn(
                    'text-4xl font-bold',
                    inv.status === 'paid' ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-white'
                  )}>
                    {formatCurrency(inv.amount, inv.currency)}
                  </p>
                  {inv.status === 'paid' && inv.paid_at && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Paid on {formatDate(inv.paid_at)}
                    </p>
                  )}
                </div>

                {/* Pay Button */}
                {canPay && (
                  <Button
                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-base font-semibold"
                    disabled={payingId === inv.id}
                    onClick={() => handlePay(inv.id)}
                  >
                    {payingId === inv.id ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
                    ) : (
                      <><CreditCard className="mr-2 h-5 w-5" /> Pay {formatCurrency(inv.amount, inv.currency)}</>
                    )}
                  </Button>
                )}

                {/* Details */}
                <div className="space-y-5">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Details</h3>
                  <div className="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 divide-y dark:divide-slate-800">
                    <div className="flex justify-between p-3.5">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Description</span>
                      <span className="text-sm text-slate-900 dark:text-white font-medium text-right max-w-[55%]">{inv.description}</span>
                    </div>
                    <div className="flex justify-between p-3.5">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Type</span>
                      <span className="text-sm text-slate-900 dark:text-white">{typeLabels[inv.type] || inv.type}</span>
                    </div>
                    {inv.programme_name && (
                      <div className="flex justify-between p-3.5">
                        <span className="text-sm text-slate-500 dark:text-slate-400">Programme</span>
                        <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">{inv.programme_name}</span>
                      </div>
                    )}
                    <div className="flex justify-between p-3.5">
                      <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" /> Due Date
                      </span>
                      <span className="text-sm text-slate-900 dark:text-white">{formatDate(inv.due_date)}</span>
                    </div>
                    <div className="flex justify-between p-3.5">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Issued</span>
                      <span className="text-sm text-slate-900 dark:text-white">{formatDate(inv.created_at)}</span>
                    </div>
                  </div>

                  {inv.notes && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3.5">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">Notes</p>
                      <p className="text-sm text-amber-800 dark:text-amber-200">{inv.notes}</p>
                    </div>
                  )}

                  {/* Payment History */}
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide pt-3">Payment History</h3>
                  {paymentsLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-12 rounded-xl" />
                      <Skeleton className="h-12 rounded-xl" />
                    </div>
                  ) : payments.length === 0 && inv.status === 'paid' && inv.paid_at ? (
                    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                      <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-full">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-900 dark:text-green-200">
                          {inv.payment_method ? inv.payment_method.replace('_', ' ') : 'Payment'}
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-300">{formatDate(inv.paid_at)}</p>
                      </div>
                      <p className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(inv.amount, inv.currency)}</p>
                    </div>
                  ) : payments.length === 0 ? (
                    <div className="text-center py-6">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                      <p className="text-xs text-slate-400">No payments recorded</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {payments.map((pmt) => (
                        <div key={pmt.id} className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 p-3.5">
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white capitalize">
                              {pmt.payment_method?.replace('_', ' ')}
                            </p>
                            <p className="text-[10px] text-slate-400">{formatDate(pmt.payment_date)}</p>
                          </div>
                          <span className="text-sm font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(pmt.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Download */}
                  <Button
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => handleDownload(inv)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </div>
                </div>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>
    </div>
  )
}
