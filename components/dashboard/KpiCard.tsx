'use client'

// A single headline figure.
//
// No sparkline. The card this replaces drew one on every stat from
// seededRandom() — a pseudo-random generator — so four invented trend lines
// were presented as history. A number with no history behind it now shows
// nothing rather than something made up.

import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

export interface KpiCardProps {
  label: string
  value: string
  /** Secondary line — a total, a breakdown, whatever the figure needs. */
  detail?: string
  icon: LucideIcon
  /** Real percentage change, or null when there is no baseline. */
  delta?: number | null
  deltaLabel?: string
  /** A rise is usually good; set false where it isn't (failures, overdue). */
  riseIsGood?: boolean
  tone?: 'default' | 'warning' | 'good'
  href?: string
  isLoading?: boolean
}

export function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  delta,
  deltaLabel,
  riseIsGood = true,
  tone = 'default',
  href,
  isLoading,
}: KpiCardProps) {
  const body = (
    <div
      className={cn(
        'group h-full rounded-xl border bg-white p-4 transition-all dark:bg-slate-900',
        tone === 'warning'
          ? 'border-amber-300 dark:border-amber-700'
          : tone === 'good'
            ? 'border-emerald-200 dark:border-emerald-800'
            : 'border-slate-200 dark:border-slate-700',
        href && 'hover:border-blue-400 hover:shadow-sm',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <Icon
          className={cn(
            'h-4 w-4 shrink-0',
            tone === 'warning'
              ? 'text-amber-500'
              : tone === 'good'
                ? 'text-emerald-500'
                : 'text-slate-400',
          )}
        />
      </div>

      {isLoading ? (
        <Skeleton className="mt-2 h-8 w-24" />
      ) : (
        <p className="mt-1.5 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
          {value}
        </p>
      )}

      <div className="mt-1 flex min-h-[18px] flex-wrap items-center gap-x-2 text-xs">
        {detail && <span className="text-slate-500 dark:text-slate-400">{detail}</span>}
        {delta != null && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-medium',
              (delta >= 0) === riseIsGood ? 'text-emerald-600' : 'text-red-600',
            )}
          >
            {delta >= 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(delta)}%{deltaLabel ? ` ${deltaLabel}` : ''}
          </span>
        )}
      </div>
    </div>
  )

  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  )
}
