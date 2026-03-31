'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, CreditCard, CheckCircle2, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import { toast } from '@/lib/hooks/use-toast'

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
  created_at: string
  notes: string | null
}

interface Payment {
  id: string
  amount: number
  payment_date: string
  payment_method: string
  reference: string | null
}

function getPlayerStatus(status: string): { label: string; className: string } {
  switch (status) {
    case 'paid':
      return { label: 'Paid', className: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' }
    case 'overdue':
      return { label: 'Overdue', className: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' }
    case 'cancelled':
      return { label: 'Cancelled', className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' }
    default:
      return { label: 'Unpaid', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' }
  }
}

export default function PortalInvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    const fetchInvoice = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('contact_id')
        .eq('id', user.id)
        .single()

      if (!profile?.contact_id) return

      const { data: inv } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', params.id)
        .eq('contact_id', profile.contact_id)
        .single()

      if (!inv) {
        router.replace('/portal/invoices')
        return
      }

      setInvoice(inv)

      const { data: pmts } = await supabase
        .from('payments')
        .select('id, amount, payment_date, payment_method, reference')
        .eq('invoice_id', params.id)
        .order('payment_date', { ascending: false })

      setPayments(pmts || [])
      setLoading(false)
    }

    fetchInvoice()
  }, [params.id, router])

  const handlePay = async () => {
    if (!invoice) return
    setPaying(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoice.id }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to start payment', variant: 'destructive' })
    }
    setPaying(false)
  }

  const formatCurrency = (amount: number, currency = 'GBP') => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  if (!invoice) return null

  const canPay = invoice.status !== 'paid' && invoice.status !== 'cancelled' && invoice.status !== 'draft'

  return (
    <div className="space-y-4">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {/* Invoice Header */}
      <Card className="bg-white dark:bg-slate-900">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{invoice.invoice_number}</h1>
            <Badge className={getPlayerStatus(invoice.status).className} variant="secondary">
              {getPlayerStatus(invoice.status).label}
            </Badge>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Description</span>
              <span className="text-slate-900 dark:text-white font-medium text-right max-w-[60%]">{invoice.description}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Type</span>
              <span className="text-slate-900 dark:text-white capitalize">{invoice.type?.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Due Date</span>
              <span className="text-slate-900 dark:text-white">{formatDate(invoice.due_date)}</span>
            </div>
            {invoice.paid_at && (
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Paid On</span>
                <span className="text-green-600 dark:text-green-400">{formatDate(invoice.paid_at)}</span>
              </div>
            )}
            {invoice.notes && (
              <div className="pt-2 border-t dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 text-xs">Notes</span>
                <p className="text-slate-700 dark:text-slate-300 mt-1">{invoice.notes}</p>
              </div>
            )}
          </div>

          {/* Amount */}
          <div className="mt-6 pt-4 border-t dark:border-slate-800 flex items-end justify-between">
            <span className="text-sm text-slate-500 dark:text-slate-400">Total Amount</span>
            <span className="text-3xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(invoice.amount, invoice.currency)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Pay Button */}
      {canPay && (
        <Button
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-base font-semibold"
          disabled={paying}
          onClick={handlePay}
        >
          {paying ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-5 w-5" />
              Pay {formatCurrency(invoice.amount, invoice.currency)}
            </>
          )}
        </Button>
      )}

      {invoice.status === 'paid' && (
        <div className="flex items-center justify-center gap-2 py-3 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">Payment Complete</span>
        </div>
      )}

      {/* Payment History */}
      {payments.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Payment History</h2>
          <div className="space-y-2">
            {payments.map((pmt) => (
              <Card key={pmt.id} className="bg-white dark:bg-slate-900">
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white capitalize">
                      {pmt.payment_method?.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-slate-400">{formatDate(pmt.payment_date)}</p>
                  </div>
                  <span className="text-sm font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(pmt.amount)}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
