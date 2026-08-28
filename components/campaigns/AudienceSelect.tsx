'use client'

// One searchable multi-select used for all three campaign audience sources
// (lists, tags, pipeline stages). Previously each source had its own copy of
// this markup, which is how the scroll fix ended up applied to one of them and
// not the other two.
//
// Scroll note: this popover renders inside the campaign Sheet, whose body is
// the page's scroll container. Without stopping the wheel event the outer
// sheet steals it and the option list feels frozen — with 220 tags that made
// the tag picker unusable. `overscroll-contain` handles the trackpad
// chaining case, `onWheel` handles the rest.

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/utils/format'

export interface AudienceOption {
  id: string
  name: string
  /** Contacts / deals behind this option, shown as the right-hand meta. */
  count?: number
  /** Swatch colour, for tags and stages. */
  color?: string | null
  /** Optional heading this option sits under (pipeline name, for stages). */
  group?: string
}

interface AudienceSelectProps {
  label: string
  icon: React.ReactNode
  options: AudienceOption[]
  selectedIds: string[]
  onToggle: (id: string) => void
  onClear: () => void
  /** Noun for the meta column and chips, e.g. "contacts" or "deals". */
  countNoun?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  /** Shown under the trigger when nothing is loaded at all. */
  noOptionsText?: string
}

export function AudienceSelect({
  label,
  icon,
  options,
  selectedIds,
  onToggle,
  onClear,
  countNoun = 'contacts',
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'Nothing matches that search',
  noOptionsText,
}: AudienceSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.name.toLowerCase().includes(q))
  }, [options, search])

  // Preserve incoming order but insert a heading whenever the group changes.
  const rows = useMemo(() => {
    const out: Array<{ heading: string } | { option: AudienceOption }> = []
    let lastGroup: string | undefined
    for (const option of filtered) {
      if (option.group && option.group !== lastGroup) {
        out.push({ heading: option.group })
        lastGroup = option.group
      }
      out.push({ option })
    }
    return out
  }, [filtered])

  const selected = options.filter((o) => selectedIds.includes(o.id))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          {icon}
          {label}
        </Label>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            disabled={options.length === 0}
          >
            <span className={cn(selected.length === 0 && 'text-muted-foreground')}>
              {options.length === 0
                ? (noOptionsText ?? 'None available')
                : selected.length === 0
                  ? placeholder
                  : `${selected.length} selected`}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="border-b p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8"
              />
            </div>
          </div>

          <div
            className="max-h-[280px] overflow-y-auto overscroll-contain p-1"
            onWheel={(e) => e.stopPropagation()}
          >
            {rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
            ) : (
              rows.map((row, i) =>
                'heading' in row ? (
                  <div
                    key={`h-${row.heading}-${i}`}
                    className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {row.heading}
                  </div>
                ) : (
                  <button
                    key={row.option.id}
                    type="button"
                    onClick={() => onToggle(row.option.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-md p-2 text-left',
                      selectedIds.includes(row.option.id)
                        ? 'bg-blue-50 dark:bg-blue-950'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Checkbox
                        checked={selectedIds.includes(row.option.id)}
                        className="pointer-events-none"
                      />
                      {row.option.color && (
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: row.option.color }}
                        />
                      )}
                      <span className="truncate text-sm font-medium">{row.option.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatNumber(row.option.count ?? 0)}
                    </span>
                  </button>
                ),
              )
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((option) => (
            <Badge
              key={option.id}
              variant="secondary"
              className="max-w-full gap-1 pr-1 font-normal"
              style={
                option.color
                  ? {
                      backgroundColor: `${option.color}1a`,
                      color: option.color,
                      borderColor: `${option.color}66`,
                    }
                  : undefined
              }
            >
              <span className="truncate">{option.name}</span>
              <span className="opacity-70">
                {formatNumber(option.count ?? 0)} {countNoun}
              </span>
              <button
                type="button"
                onClick={() => onToggle(option.id)}
                className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                aria-label={`Remove ${option.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
