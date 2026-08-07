'use client'

import { useState } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BookOpen, Search } from 'lucide-react'
import { useBrochures } from '@/lib/hooks/useWebsiteBrochures'
import type { WebsiteBrochure } from '@/lib/types/website-content'

const BROCHURE_PUBLIC_BASE = 'https://theinternationalfootballgroup.com/b'

/** Public URL for a published brochure. */
export function brochurePublicUrl(slug: string): string {
  return `${BROCHURE_PUBLIC_BASE}/${slug}`
}

/** Branded, email-client-safe anchor button linking to a brochure. */
export function brochureButtonHtml(brochure: Pick<WebsiteBrochure, 'slug'>): string {
  const url = brochurePublicUrl(brochure.slug)
  return `<p style="text-align:center;margin:24px 0"><a href="${url}" style="background:#BE1623;color:#fff;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:999px;display:inline-block">View the brochure →</a></p>`
}

interface BrochureInsertPopoverProps {
  /** Called with the picked brochure so the caller can insert HTML + record the association. */
  onInsert: (brochure: WebsiteBrochure) => void
}

export function BrochureInsertPopover({ onInsert }: BrochureInsertPopoverProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { data: brochures = [], isLoading } = useBrochures()

  const published = brochures.filter((b) => b.published)
  const filtered = published.filter((b) =>
    b.title.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs">
          <BookOpen className="h-3 w-3 mr-1" />
          Insert Brochure
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="end" sideOffset={4}>
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search brochures..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <div className="max-h-[240px] overflow-y-auto p-1">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {published.length === 0 ? 'No published brochures' : 'No brochures found'}
            </p>
          ) : (
            filtered.map((brochure) => (
              <button
                key={brochure.id}
                type="button"
                className="flex w-full flex-col items-start gap-0.5 rounded-md p-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={() => {
                  onInsert(brochure)
                  setOpen(false)
                  setQuery('')
                }}
              >
                <span className="text-sm font-medium">{brochure.title}</span>
                <span className="text-xs text-muted-foreground truncate max-w-full">
                  /b/{brochure.slug}
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
