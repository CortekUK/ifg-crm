'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Mail, Phone, ShoppingCart, Check } from 'lucide-react'
import { useAbandonedDeposits, useUpdateInvoiceStatus } from '@/lib/hooks/useInvoices'
import { formatCurrency } from '@/lib/utils/format'
import { toast } from '@/lib/hooks/use-toast'
import type { Invoice } from '@/lib/types/invoices'

/**
 * "Abandoned checkouts" — website visitors who reached Stripe (deposit or full
 * payment) but didn't pay. Warm leads for IFG to follow up. Renders above the
 * invoices table; hides itself entirely when there are none.
 */
export function AbandonedDeposits({ onView }: { onView?: (invoice: Invoice) => void }) {
  const { data: rows = [], isLoading } = useAbandonedDeposits()
  const updateStatus = useUpdateInvoiceStatus()
  const [open, setOpen] = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <Card className="border border-slate-200 dark:border-slate-700 border-l-4 border-l-amber-400">
        <CardContent className="p-4">
          <Skeleton className="h-5 w-56" />
        </CardContent>
      </Card>
    )
  }

  if (rows.length === 0) return null

  const name = (inv: Invoice) =>
    inv.contact ? `${inv.contact.first_name || ''} ${inv.contact.last_name || ''}`.trim() || 'Unknown' : 'Unknown'

  // "Summer Residency — deposit to secure your place" → "Summer Residency"
  const programme = (inv: Invoice) => (inv.description || '').split('—')[0].trim() || '—'

  async function markPaid(inv: Invoice) {
    setMarkingId(inv.id)
    try {
      await updateStatus.mutateAsync({ invoiceId: inv.id, status: 'paid' })
      toast({ title: 'Marked as paid', description: `${name(inv)}'s ${inv.type === 'full_payment' ? 'payment' : 'deposit'} recorded.` })
    } catch (e) {
      toast({ title: 'Could not update', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setMarkingId(null)
    }
  }

  return (
    <Card className="relative overflow-hidden border border-slate-200 dark:border-slate-700 border-l-4 border-l-amber-400">
      <CardContent className="p-0">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="rounded-full bg-amber-100 p-1.5 dark:bg-amber-900/50">
              <ShoppingCart className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-oswald text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-100">
                Abandoned checkouts
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Reached payment but didn&apos;t pay — warm leads to follow up
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              {rows.length}
            </span>
            {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          </div>
        </button>

        {open && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
            {rows.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <div className="min-w-[160px] flex-1">
                  <button
                    onClick={() => onView?.(inv)}
                    className="text-sm font-semibold text-slate-900 hover:underline dark:text-white"
                  >
                    {name(inv)}
                  </button>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {inv.contact?.email && (
                      <a href={`mailto:${inv.contact.email}`} className="inline-flex items-center gap-1 hover:text-blue-600">
                        <Mail className="h-3 w-3" /> {inv.contact.email}
                      </a>
                    )}
                    {inv.contact?.phone && (
                      <a href={`tel:${inv.contact.phone}`} className="inline-flex items-center gap-1 hover:text-blue-600">
                        <Phone className="h-3 w-3" /> {inv.contact.phone}
                      </a>
                    )}
                  </div>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium dark:bg-slate-800">
                    {programme(inv)}
                  </span>
                  <span className="ml-2">{inv.type === 'full_payment' ? 'Full payment' : 'Deposit'}</span>
                </div>

                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(Number(inv.amount))}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => markPaid(inv)}
                  disabled={markingId === inv.id}
                  className="h-7 gap-1 text-xs"
                >
                  <Check className="h-3 w-3" /> Mark paid
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
