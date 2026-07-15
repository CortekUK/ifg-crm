'use client'

import * as React from 'react'
import { format, parse, isValid } from 'date-fns'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { CalendarIcon, Loader2, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// The website renders the clinic date as free text (e.g. "12 July 2026"), so we
// store that human-readable string — the picker just produces it.
const DATE_DISPLAY = 'd MMMM yyyy'

function parseDisplayDate(value: string): Date | undefined {
  if (!value) return undefined
  const parsed = parse(value, DATE_DISPLAY, new Date())
  if (isValid(parsed)) return parsed
  const loose = new Date(value)
  return isValid(loose) ? loose : undefined
}

/** Accent tints for the header icon chip — mirrors the tabs/section palette. */
export const ACCENT: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400',
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400',
}

/**
 * Shared premium shell for every website-content editor. Gives each modal a
 * consistent structure: coloured icon header with a subtitle, a scrollable body,
 * and a sticky footer with Cancel / Save. Children are the form fields only.
 */
export function ContentDialog({
  open,
  onClose,
  icon: Icon,
  accent = 'blue',
  title,
  description,
  onSubmit,
  submitLabel,
  saving,
  children,
}: {
  open: boolean
  onClose: () => void
  icon: LucideIcon
  accent?: keyof typeof ACCENT | string
  title: string
  description?: string
  onSubmit: () => void
  submitLabel: string
  saving?: boolean
  children: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[92vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-border/70 px-6 py-4">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', ACCENT[accent] ?? ACCENT.blue)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-oswald text-lg font-semibold leading-tight text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 -mt-1 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <form
          id="content-dialog-form"
          onSubmit={(e) => { e.preventDefault(); onSubmit() }}
          className="flex-1 space-y-5 overflow-y-auto px-6 py-5"
        >
          {children}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border/70 bg-muted/30 px-6 py-3.5">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="content-dialog-form" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** A grouped section with an optional small heading — used to structure long forms. */
export function FormSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      {title && (
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      )}
      {children}
    </div>
  )
}

/** Label + optional hint wrapper around a single control. */
export function Field({
  label,
  hint,
  required,
  htmlFor,
  children,
  className,
}: {
  label: string
  hint?: React.ReactNode
  required?: boolean
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/**
 * Date picker that reads/writes the human-readable display string used across
 * the site. Any legacy free-text value that can't be parsed is preserved and
 * shown until the user picks a new date.
 */
export function DateField({
  label,
  hint,
  value,
  onChange,
  placeholder = 'Select a date',
}: {
  label: string
  hint?: React.ReactNode
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = React.useState(false)
  const selected = parseDisplayDate(value)

  return (
    <Field label={label} hint={hint}>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground')}
            >
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">{value || placeholder}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected}
              onSelect={(d) => {
                if (d) onChange(format(d, DATE_DISPLAY))
                setOpen(false)
              }}
              autoFocus
            />
          </PopoverContent>
        </Popover>
        {value && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onChange('')}
            aria-label="Clear date"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Field>
  )
}

/** Responsive row of fields. */
export function FieldRow({ cols = 2, children }: { cols?: 2 | 3; children: React.ReactNode }) {
  return (
    <div className={cn('grid grid-cols-1 gap-4', cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
      {children}
    </div>
  )
}

/**
 * Published toggle + sort order, presented as a tidy card so it reads as
 * "visibility settings" rather than two stray inputs.
 */
export function PublishControls({
  published,
  onPublishedChange,
  sortOrder,
  onSortOrderChange,
}: {
  published: boolean
  onPublishedChange: (v: boolean) => void
  sortOrder: number | string
  onSortOrderChange?: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
      <label className="flex cursor-pointer items-center gap-3">
        <Switch checked={published} onCheckedChange={onPublishedChange} />
        <span>
          <span className="block text-sm font-medium text-foreground">{published ? 'Published' : 'Draft'}</span>
          <span className="block text-xs text-muted-foreground">
            {published ? 'Visible on the live website.' : 'Hidden until you publish.'}
          </span>
        </span>
      </label>
      {onSortOrderChange && (
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Sort order</Label>
          <Input
            type="number"
            className="h-9 w-20"
            value={sortOrder}
            onChange={(e) => onSortOrderChange(e.target.value)}
          />
        </div>
      )}
    </div>
  )
}
