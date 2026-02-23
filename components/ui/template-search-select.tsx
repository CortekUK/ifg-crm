'use client'

import { useState, useRef, useEffect } from 'react'
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
}

interface TemplateSearchSelectProps {
  templates: TemplateOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function TemplateSearchSelect({
  templates,
  value,
  onValueChange,
  placeholder = 'Select a template',
  className,
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

  useEffect(() => {
    if (open) {
      setSearch('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
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
        <div className="max-h-[200px] overflow-y-auto overscroll-contain p-1">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No templates found.
            </p>
          ) : (
            filtered.map((template) => (
              <button
                key={template.id}
                type="button"
                className={cn(
                  'relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none',
                  'hover:bg-accent hover:text-accent-foreground',
                  value === template.id && 'bg-accent text-accent-foreground'
                )}
                onClick={() => {
                  onValueChange(template.id)
                  setOpen(false)
                }}
              >
                <Check
                  className={cn(
                    'h-4 w-4 shrink-0',
                    value === template.id ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {template.name}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
