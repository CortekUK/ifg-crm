'use client'

// Who is in the database, and where they came from.
//
// The lead-source figures are counted in SQL. The chart this replaces pulled
// `contacts.source` into the browser and tallied it, which PostgREST capped at
// 1000 rows — so it drew percentages of the first thousand of 105,285 contacts
// and presented them as the whole database.

import Link from 'next/link'
import { List as ListIcon, PieChart, Tag as TagIcon } from 'lucide-react'
import type { DashboardOverview } from '@/lib/hooks/useDashboardOverview'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/utils/format'

const SOURCE_LABELS: Record<string, string> = {
  website_form: 'Website form',
  website_brochure: 'Brochure',
  website_chatbot: 'Chatbot',
  website_deposit: 'Deposit',
  website_exit_intent: 'Exit intent',
  website_university: 'University page',
  csv_import: 'CSV import',
  email_campaign: 'Email campaign',
  sms_reply: 'SMS reply',
  email_reply: 'Email reply',
  manual: 'Added by hand',
  unknown: 'Not recorded',
}

export function AudienceSnapshot({
  data,
  isLoading,
}: {
  data?: DashboardOverview
  isLoading?: boolean
}) {
  const sources = data?.lead_sources ?? []
  const total = sources.reduce((sum, s) => sum + s.count, 0)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 lg:col-span-1">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
          <PieChart className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Where contacts came from
          </h2>
        </div>
        <div className="space-y-2 p-4">
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            sources.map((s) => (
              <div key={s.source} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate text-xs text-slate-600 dark:text-slate-300">
                  {SOURCE_LABELS[s.source] ?? s.source}
                </span>
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <span
                    className="block h-full rounded-full bg-blue-500"
                    style={{ width: `${total ? Math.max(2, (s.count / total) * 100) : 0}%` }}
                  />
                </span>
                <span className="w-14 shrink-0 text-right text-xs tabular-nums text-slate-500">
                  {formatNumber(s.count)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <ListPanel
        title="Biggest lists"
        icon={ListIcon}
        href="/lists"
        isLoading={isLoading}
        rows={(data?.top_lists ?? []).map((l) => ({ id: l.id, name: l.name, count: l.count }))}
      />
      <ListPanel
        title="Biggest tags"
        icon={TagIcon}
        href="/tags"
        isLoading={isLoading}
        rows={(data?.top_tags ?? []).map((t) => ({
          id: t.id, name: t.name, count: t.count, colour: t.colour,
        }))}
      />
    </div>
  )
}

function ListPanel({
  title,
  icon: Icon,
  href,
  rows,
  isLoading,
}: {
  title: string
  icon: React.ElementType
  href: string
  rows: { id: string; name: string; count: number; colour?: string | null }[]
  isLoading?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
        </div>
        <Link href={href} className="text-xs font-medium text-blue-600 hover:underline">
          All
        </Link>
      </div>
      <div className="p-4">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-2">
                {r.colour && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: r.colour }}
                  />
                )}
                <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                  {r.name}
                </span>
                <span className="text-xs tabular-nums text-slate-500">
                  {formatNumber(r.count)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
