// Reusable page-shaped skeletons. Each `loading.tsx` in the dashboard pulls
// one of these and renders it directly — keeps the per-route file to a
// couple of lines and ensures every page has the same shimmer rhythm.
//
// Composition:
//   <PageHeaderSkeleton />     — title bar + a couple of action buttons
//   <KpiRowSkeleton />         — row of 3-4 stat cards (used on dashboard)
//   <TableSkeleton />          — bordered table with N rows × M columns
//   <CardGridSkeleton />       — responsive grid of cards
//   <KanbanSkeleton />         — pipeline-style board with stage columns
//
// Wrap them in <PageSkeleton> for the standard "header + body" layout.

import { cn } from '@/lib/utils'
import { Skeleton } from './skeleton'

export function PageSkeleton({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('space-y-6', className)}>{children}</div>
}

export function PageHeaderSkeleton({
  withActions = true,
  withSubtitle = false,
}: {
  withActions?: boolean
  withSubtitle?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        {withSubtitle && <Skeleton className="h-4 w-72" />}
      </div>
      {withActions && (
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
      )}
    </div>
  )
}

export function KpiRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40"
        >
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-8 w-24" />
          <Skeleton className="mt-2 h-3 w-32" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({
  rows = 8,
  cols = 5,
  withFilters = true,
}: {
  rows?: number
  cols?: number
  withFilters?: boolean
}) {
  return (
    <div className="space-y-3">
      {withFilters && (
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 flex-1 max-w-sm" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/40">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: cols }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-20" />
            ))}
          </div>
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="border-b border-slate-100 px-4 py-3 last:border-0 dark:border-slate-800"
          >
            <div className="grid items-center gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {Array.from({ length: cols }).map((_, c) => (
                <Skeleton
                  key={c}
                  className={cn('h-4', c === 0 ? 'w-4/5' : c === cols - 1 ? 'w-1/2' : 'w-3/5')}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CardGridSkeleton({
  count = 6,
  columns = 3,
}: {
  count?: number
  columns?: 2 | 3 | 4
}) {
  const colClass =
    columns === 2 ? 'md:grid-cols-2' : columns === 3 ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'
  return (
    <div className={cn('grid grid-cols-1 gap-4', colClass)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function KanbanSkeleton({
  columns = 5,
  cardsPerColumn = 3,
}: {
  columns?: number
  cardsPerColumn?: number
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {Array.from({ length: columns }).map((_, c) => (
        <div
          key={c}
          className="flex w-72 shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-900/40"
        >
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: cardsPerColumn }).map((_, i) => (
              <div
                key={i}
                className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
              >
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
