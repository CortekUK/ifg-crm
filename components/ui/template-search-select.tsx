'use client'

import { useState, useRef } from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface TemplateOption {
  id: string
  name: string
  /** Optional — only read when `groupByCategory` is on. */
  category?: string
  /** Optional second line, e.g. the template's subject. */
  subject?: string
}

interface TemplateSearchSelectProps {
  templates: TemplateOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
  /**
   * Insert a heading whenever `category` changes. Off by default so the
   * automations pickers keep their existing flat list; the campaign picker
   * turns it on because it now offers all 26 templates, not just the 4
   * tagged `campaign`.
   */
  groupByCategory?: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  campaign: 'Campaign templates',
  automation: 'Automation templates',
  transactional: 'Transactional templates',
}

export function TemplateSearchSelect({
  templates,
  value,
  onValueChange,
  placeholder = 'Select a template',
  className,
  groupByCategory = false,
}: TemplateSearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedTemplate = templates.find((t) => t.id === value)

  const filtered = search
    ? templates.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase())
      )
    : templates

  const rows: Array<{ heading: string } | { template: TemplateOption }> = []
  let lastCategory: string | undefined
  for (const template of filtered) {
    if (groupByCategory && template.category && template.category !== lastCategory) {
      rows.push({ heading: CATEGORY_LABELS[template.category] ?? template.category })
      lastCategory = template.category
    }
    rows.push({ template })
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setSearch('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className="truncate">
            {selectedTemplate ? selectedTemplate.name : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 shrink-0 opacity-50" />
          <Input
            ref={inputRef}
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div
          className="max-h-[320px] overflow-y-auto overscroll-contain p-1"
          // Stop wheel events from bubbling to the parent Radix ScrollArea
          // viewport in the configure step — without this, wheel scroll
          // inside the dropdown gets stolen by the modal's outer scroll
          // and the list feels unresponsive.
          onWheel={(e) => e.stopPropagation()}
        >
          {rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No templates found.
            </p>
          ) : (
            rows.map((row, i) =>
              'heading' in row ? (
                <div
                  key={`h-${row.heading}-${i}`}
                  className="px-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {row.heading}
                </div>
              ) : (
                <button
                  key={row.template.id}
                  type="button"
                  className={cn(
                    'relative flex w-full cursor-default items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none select-none',
                    'hover:bg-accent hover:text-accent-foreground',
                    value === row.template.id && 'bg-accent text-accent-foreground'
                  )}
                  onClick={() => {
                    onValueChange(row.template.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      value === row.template.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{row.template.name}</span>
                    {row.template.subject && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {row.template.subject}
                      </span>
                    )}
                  </span>
                </button>
              )
            )
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
