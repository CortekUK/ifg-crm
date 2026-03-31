'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ReceiptPoundSterling, CreditCard, Loader2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/utils/format'
import { toast } from '@/lib/hooks/use-toast'

interface Invoice {
  id: string
  invoice_number: string
  description: string
  amount: number
  currency: string
  status: string
  due_date: string
  created_at: string
}

// Map internal statuses to player-friendly labels
function getPlayerStatus(status: string): { label: string; className: string } {
  switch (status) {
    case 'paid':
      return { label: 'Paid', className: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' }
    case 'overdue':
      return { label: 'Overdue', className: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' }
    case 'cancelled':
      return { label: 'Cancelled', className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' }
    default:
      // draft, sent, viewed all show as "Unpaid" for player
      return { label: 'Unpaid', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' }
  }
}

export default function PortalInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('all')
  const [search, setSearch] = useState('')
  const [payingId, setPayingId] = useState<string | null>(null)

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

      const { data } = await supabase
        .from('invoices')
        .select('id, invoice_number, description, amount, currency, status, due_date, created_at')
        .eq('contact_id', profile.contact_id)
        .order('created_at', { ascending: false })

      setInvoices(data || [])
      setLoading(false)
    }

    fetchInvoices()
  }, [])

  const handlePay = async (invoiceId: string) => {
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

  const formatCurrency = (amount: number, currency = 'GBP') => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount)
  }

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
        <div className="flex gap-2">
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-16" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Invoices</h1>

      {/* Search + Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search invoices..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'unpaid', 'paid'] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
            className={filter === f ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'unpaid' && (
              <Badge variant="secondary" className="ml-1.5 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 text-[10px] px-1.5">
                {invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled').length}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Invoice List */}
      {filtered.length === 0 ? (
        <Card className="bg-white dark:bg-slate-900">
          <CardContent className="p-8 text-center">
            <ReceiptPoundSterling className="h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No invoices found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((invoice) => {
            const canPay = invoice.status !== 'paid' && invoice.status !== 'cancelled' && invoice.status !== 'draft'

            return (
              <Card key={invoice.id} className="bg-white dark:bg-slate-900">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {invoice.invoice_number}
                        </span>
                        <Badge className={getPlayerStatus(invoice.status).className} variant="secondary">
                          {getPlayerStatus(invoice.status).label}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mb-2">
                        {invoice.description}
                      </p>
                      <p className="text-[10px] text-slate-400">Due {formatDate(invoice.due_date)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </p>
                      {canPay && (
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                          disabled={payingId === invoice.id}
                          onClick={() => handlePay(invoice.id)}
                        >
                          {payingId === invoice.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                              Pay Now
                            </>
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
    </div>
  )
}
