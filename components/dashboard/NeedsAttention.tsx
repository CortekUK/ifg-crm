'use client'

// The one panel that says whether anything needs doing.
//
// It replaces four separate widgets — unmatched SMS, unmatched email, SMS
// follow-ups, email follow-ups — which between them occupied half the
// dashboard and, in this database, all showed zero. A queue with nothing in it
// should take one line, not four cards.

import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, type LucideIcon } from 'lucide-react'
import { BookOpen, FileEdit, MessageSquareWarning, Receipt, Timer } from 'lucide-react'
import type { DashboardOverview } from '@/lib/hooks/useDashboardOverview'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/format'

interface Item {
  label: string
  count: number
  href: string
  icon: LucideIcon
  /** Advisory items are worth knowing but nobody is blocked on them. */
  severity: 'urgent' | 'note'
}

export function NeedsAttention({
  data,
  isLoading,
}: {
  data?: DashboardOverview
  isLoading?: boolean
}) {
  if (isLoading || !data) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-10 w-full" />
      </div>
    )
  }

  const a = data.attention
  const unmatched = a.unmatched_sms + a.unmatched_email

  const items: Item[] = ([
    { label: 'replies we could not match to a contact', count: unmatched, href: '/replies', icon: MessageSquareWarning, severity: 'urgent' },
    { label: 'invoices overdue', count: a.overdue_invoices, href: '/invoices', icon: Receipt, severity: 'urgent' },
    { label: 'deals with no activity for a fortnight', count: data.deals.stalled, href: '/pipelines', icon: Timer, severity: 'urgent' },
    { label: 'brochures still waiting to be pre-rendered', count: a.brochures_unrendered, href: '/brochures', icon: BookOpen, severity: 'note' },
    { label: 'templates still in draft', count: a.draft_templates, href: '/templates', icon: FileEdit, severity: 'note' },
  ] as Item[]).filter((i) => i.count > 0)

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/40">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        <p className="text-sm text-emerald-800 dark:text-emerald-300">
          Nothing needs attention — no unmatched replies, no overdue invoices, no
          stalled deals.
        </p>
      </div>
    )
  }

  const urgent = items.some((i) => i.severity === 'urgent')

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
        <AlertTriangle className={urgent ? 'h-4 w-4 text-amber-500' : 'h-4 w-4 text-slate-400'} />
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Needs attention</h2>
      </div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {items.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <item.icon
                className={
                  item.severity === 'urgent'
                    ? 'h-4 w-4 shrink-0 text-amber-500'
                    : 'h-4 w-4 shrink-0 text-slate-400'
                }
              />
              <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                {item.count}
              </span>
              <span className="flex-1 text-sm text-slate-600 dark:text-slate-300">
                {item.label}
                {item.label.includes('overdue') && data.attention.overdue_value > 0 && (
                  <span className="ml-1 text-slate-400">
                    ({formatCurrency(data.attention.overdue_value)})
                  </span>
                )}
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
