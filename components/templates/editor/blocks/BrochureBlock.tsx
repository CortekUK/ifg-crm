'use client'

// A brochure from the CRM, dropped into an email.
//
// The brochure is a flipbook on the public site, and page-flip is JavaScript
// that no email client will run. So the email shows the cover standing as a
// book and links to the real flipbook — the recipient clicks and lands in the
// page-turning viewer. The editor says exactly that, so nobody expects the
// pages to turn inside Gmail.

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { BookOpen, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBrochures } from '@/lib/hooks/useWebsiteBrochures'
import type { BrochureBlockContent } from '@/lib/templates/editor-types'
import type { WebsiteBrochure } from '@/lib/types/website-content'
import { useEditorTheme } from '../EditorThemeContext'

interface BrochureBlockProps {
  content: Record<string, unknown>
  isSelected: boolean
  onUpdate: (updates: Record<string, unknown>) => void
}

/** Everything the email needs, copied off the brochure at pick time so the
 *  block still renders if the row is later renamed or unpublished. */
export function brochureBlockContent(b: WebsiteBrochure): Partial<BrochureBlockContent> {
  return {
    brochureId: b.id,
    slug: b.slug,
    title: b.title,
    description: b.description ?? '',
    coverImage: b.cover_image || b.page_images?.[0] || '',
    pageCount: b.page_count ?? b.page_images?.length ?? 0,
  }
}

export function BrochureBlock({ content, isSelected, onUpdate }: BrochureBlockProps) {
  const c = content as unknown as BrochureBlockContent
  const theme = useEditorTheme()
  const { data: brochures = [], isLoading } = useBrochures()

  const pick = (b: WebsiteBrochure) => onUpdate(brochureBlockContent(b))

  return (
    <div style={{ paddingTop: c.paddingTop, paddingBottom: c.paddingBottom }}>
      {isSelected && (
        <div className="mb-3 space-y-3 rounded-lg bg-gray-50 p-3 dark:bg-slate-800">
          <div className="space-y-1.5">
            <Label className="text-xs">Brochure</Label>
            {isLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : brochures.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No brochures yet — add one on the Brochures page and it appears here.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {brochures.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => pick(b)}
                    className={cn(
                      'overflow-hidden rounded border text-left transition-all',
                      c.brochureId === b.id
                        ? 'border-indigo-500 ring-2 ring-indigo-200'
                        : 'border-slate-300 hover:border-slate-400',
                    )}
                  >
                    <span className="block h-16 bg-slate-100 dark:bg-slate-700">
                      {(b.cover_image || b.page_images?.[0]) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={b.cover_image || b.page_images?.[0]}
                          alt=""
                          className="h-16 w-full object-cover"
                        />
                      )}
                    </span>
                    <span className="block truncate px-1.5 py-1 text-[10px] font-medium">
                      {b.title}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {c.slug && (
            <>
              <div className="flex items-center gap-2">
                <Label className="w-24 shrink-0 text-xs">Button</Label>
                <Input
                  value={c.buttonText ?? ''}
                  onChange={(e) => onUpdate({ buttonText: e.target.value })}
                  placeholder="Open the brochure"
                  className="h-8 flex-1 text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <Label className="w-24 shrink-0 text-xs">Blurb</Label>
                <Input
                  value={c.description ?? ''}
                  onChange={(e) => onUpdate({ description: e.target.value })}
                  placeholder="One line about what's inside"
                  className="h-8 flex-1 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Layout</Label>
                  <div className="flex gap-1">
                    {(['book', 'wide'] as const).map((layout) => (
                      <button
                        key={layout}
                        type="button"
                        onClick={() => onUpdate({ layout })}
                        className={cn(
                          'rounded px-2 py-1 text-[11px] capitalize',
                          (c.layout ?? 'book') === layout
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
                        )}
                      >
                        {layout === 'book' ? 'Cover on top' : 'Side by side'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={c.showPageCount !== false}
                    onCheckedChange={(v) => onUpdate({ showPageCount: v })}
                  />
                  <Label className="text-xs">Show page count</Label>
                </div>
              </div>

              <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                <span>
                  The pages turn on the website, not in the inbox — no email client runs
                  the flipbook. This shows the cover as a book and opens the real
                  flipbook at{' '}
                  <code className="rounded bg-slate-200 px-1 dark:bg-slate-700">
                    /b/{c.slug}
                  </code>
                  , with the lead form skipped for someone we already know.
                </span>
              </p>
            </>
          )}
        </div>
      )}

      {/* Preview — the same book shape the renderer emits. */}
      {c.slug ? (
        <div
          className={cn(
            'flex gap-4',
            (c.layout ?? 'book') === 'book' ? 'flex-col items-center text-center' : 'items-start',
          )}
        >
          <div className="flex shrink-0">
            <span className="w-1.5 rounded-l" style={{ backgroundColor: theme.primaryColor }} />
            {c.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.coverImage} alt={c.title} className="w-[160px] shadow-md" />
            ) : (
              <span className="flex h-[210px] w-[160px] items-center justify-center bg-slate-200 text-xs text-slate-500">
                No cover yet
              </span>
            )}
            <span className="w-[3px] bg-[#d9dde3]" />
            <span className="w-[2px] rounded-r bg-[#eef1f5]" />
          </div>

          <div className={cn((c.layout ?? 'book') === 'book' && 'w-full')}>
            <div
              className="text-lg font-bold"
              style={{ color: theme.inkColor, fontFamily: 'inherit' }}
            >
              {c.title}
            </div>
            {c.description && (
              <div className="mt-1 text-sm" style={{ color: theme.mutedColor }}>
                {c.description}
              </div>
            )}
            {c.showPageCount !== false && !!c.pageCount && (
              <div
                className="mt-1.5 text-[11px] uppercase tracking-wider"
                style={{ color: theme.mutedColor }}
              >
                {c.pageCount} pages · flip through it online
              </div>
            )}
            <span
              className="mt-3 inline-block px-6 py-2.5 text-sm font-bold text-white"
              style={{
                backgroundColor: theme.primaryColor,
                borderRadius: theme.corners === 'pill' ? 999 : theme.corners === 'square' ? 0 : 8,
              }}
            >
              {c.buttonText || 'Open the brochure'}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded border-2 border-dashed border-slate-300 py-8 text-slate-400">
          <BookOpen className="h-6 w-6" />
          <span className="text-sm">Select this block and pick a brochure</span>
        </div>
      )}
    </div>
  )
}
