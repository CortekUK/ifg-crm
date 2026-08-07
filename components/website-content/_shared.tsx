'use client'

import * as React from 'react'
import { Plus, Pencil, Trash2, Loader2, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

export const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'

export const TINT: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400',
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

export function StatusPill({ published }: { published: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
      published
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full', published ? 'bg-emerald-500' : 'bg-amber-500')} />
      {published ? 'Live' : 'Draft'}
    </span>
  )
}

export function CardActions({ onEdit, onDelete, deleting }: { onEdit: () => void; onDelete: () => void; deleting: boolean }) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-white/95 p-0.5 shadow-sm backdrop-blur dark:bg-slate-900/95">
      <button onClick={onEdit} className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Edit">
        <Pencil className="h-4 w-4" />
      </button>
      <button onClick={onDelete} disabled={deleting} className="rounded-md p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40" aria-label="Delete">
        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </button>
    </div>
  )
}

export function ContentCard({
  thumb, title, subtitle, badge, published, fallbackIcon: Icon, onEdit, onDelete, deleting,
}: {
  thumb: string | null
  title: string
  subtitle: string
  badge?: string | null
  published: boolean
  fallbackIcon: LucideIcon
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100 dark:bg-slate-800">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-600">
            <Icon className="h-9 w-9" />
          </div>
        )}
        <div className="absolute left-2.5 top-2.5"><StatusPill published={published} /></div>
        <div className="absolute right-2.5 top-2.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
          <CardActions onEdit={onEdit} onDelete={onDelete} deleting={deleting} />
        </div>
      </div>
      <div className="p-3">
        {badge && <span className="mb-1 inline-block text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">{badge}</span>}
        <p className="truncate font-medium text-slate-900 dark:text-white">{title}</p>
        {subtitle && <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  )
}

export function FaqCard({
  question, answer, published, onEdit, onDelete, deleting,
}: {
  question: string
  answer: string
  published: boolean
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <div className="group relative flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="font-medium text-slate-900 dark:text-white">{question}</p>
          <StatusPill published={published} />
        </div>
        {answer && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{answer}</p>}
      </div>
      <div className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
        <CardActions onEdit={onEdit} onDelete={onDelete} deleting={deleting} />
      </div>
    </div>
  )
}

export function GridSkeleton({ list }: { list?: boolean }) {
  return (
    <div className={list ? 'space-y-3' : GRID}>
      {Array.from({ length: list ? 4 : 6 }).map((_, i) =>
        list ? (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ) : (
          <div key={i} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <Skeleton className="aspect-[16/10] w-full rounded-none" />
            <div className="space-y-2 p-3"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/2" /></div>
          </div>
        ),
      )}
    </div>
  )
}

export function EmptyState({
  icon: Icon, tint, title, description, addLabel, onAdd,
}: {
  icon: LucideIcon
  tint: string
  title: string
  description: string
  addLabel: string
  onAdd: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <div className={cn('mb-4 flex h-14 w-14 items-center justify-center rounded-2xl', tint)}>
        <Icon className="h-7 w-7" />
      </div>
      <p className="font-medium text-slate-900 dark:text-white">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      <Button className="mt-5" onClick={onAdd}><Plus className="mr-2 h-4 w-4" />{addLabel}</Button>
    </div>
  )
}

// Collection section: coloured header + add button, then grid/list/empty/loading.
export function Section({
  icon: Icon, tint, title, description, count, addLabel, onAdd, loading, isEmpty, empty, children,
}: {
  icon: LucideIcon
  tint: string
  title: string
  description: string
  count: number
  addLabel?: string
  onAdd?: () => void
  loading: boolean
  isEmpty: boolean
  empty: { title: string; description: string; list?: boolean }
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', tint)}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="flex items-center gap-2 font-oswald text-lg font-semibold text-slate-900 dark:text-white">
              {title}
              {!loading && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{count}</span>}
            </h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {addLabel && onAdd && (
          <Button onClick={onAdd} className="shrink-0"><Plus className="mr-2 h-4 w-4" />{addLabel}</Button>
        )}
      </div>
      {loading ? <GridSkeleton list={empty.list} /> : isEmpty ? (
        <EmptyState icon={Icon} tint={tint} title={empty.title} description={empty.description} addLabel={addLabel ?? 'Add'} onAdd={onAdd ?? (() => {})} />
      ) : children}
    </div>
  )
}

// Shared delete-confirm dialog driven by a target object.
export function DeleteConfirm({
  target, onCancel, onConfirm,
}: {
  target: { label: string } | null
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={!!target} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{target?.label}”?</AlertDialogTitle>
          <AlertDialogDescription>This removes it from the live website. This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
