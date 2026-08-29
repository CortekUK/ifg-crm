'use client'

// Campaigns and brochures — the whole marketing side of the CRM, which the
// old dashboard did not mention at all.

import Link from 'next/link'
import { BookOpen, Download, Eye, Send, Users } from 'lucide-react'
import type { DashboardOverview } from '@/lib/hooks/useDashboardOverview'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/utils/format'

function Rate({ label, value, of }: { label: string; value: number; of: number }) {
  // A percentage of nothing is not 0% — it is unknown, and printing 0% for it
  // reads as a failed campaign rather than an unsent one.
  const pct = of > 0 ? Math.round((value / of) * 100) : null
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
        {formatNumber(value)}
        {pct != null && <span className="ml-1 text-xs font-normal text-slate-400">{pct}%</span>}
      </p>
    </div>
  )
}

export function MarketingSnapshot({
  data,
  isLoading,
}: {
  data?: DashboardOverview
  isLoading?: boolean
}) {
  const campaign = data?.last_campaign
  const brochures = data?.brochures ?? []

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Last campaign</h2>
          </div>
          <Link href="/campaigns" className="text-xs font-medium text-blue-600 hover:underline">
            Campaigns
          </Link>
        </div>
        <div className="p-4">
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : !campaign ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No campaign has been sent yet.
            </p>
          ) : (
            <>
              <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                {campaign.name}
              </p>
              <p className="mb-3 text-xs text-slate-400">
                {campaign.sent_at
                  ? new Date(campaign.sent_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })
                  : 'not sent'}
              </p>
              <div className="grid grid-cols-4 gap-2">
                <Rate label="Sent" value={campaign.recipients} of={0} />
                <Rate label="Delivered" value={campaign.delivered} of={campaign.recipients} />
                <Rate label="Opened" value={campaign.opened} of={campaign.delivered} />
                <Rate label="Clicked" value={campaign.clicked} of={campaign.delivered} />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Brochures</h2>
          </div>
          <Link href="/brochures" className="text-xs font-medium text-blue-600 hover:underline">
            Brochures
          </Link>
        </div>
        <div className="p-4">
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : brochures.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No published brochures.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {brochures.map((b) => (
                <li key={b.id} className="flex items-center gap-3">
                  <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                    {b.title}
                  </span>
                  <span className="flex items-center gap-1 text-xs tabular-nums text-slate-500">
                    <Users className="h-3 w-3" />
                    {b.people}
                  </span>
                  <span className="flex items-center gap-1 text-xs tabular-nums text-slate-500">
                    <Eye className="h-3 w-3" />
                    {b.opens}
                  </span>
                  <span className="flex items-center gap-1 text-xs tabular-nums text-slate-500">
                    <Download className="h-3 w-3" />
                    {b.downloads}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
