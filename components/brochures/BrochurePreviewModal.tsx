'use client'

// Staff preview of a brochure, in the same flipbook the public site uses.
//
// Deliberately not "open the public link": that page is gated, so previewing
// meant a staff member typing their own details into the lead form and landing
// in the brochure's list as a fake lead. This reads the pre-rendered page
// images straight from the CRM — no gate, and nothing is tracked.

import * as React from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react'
import type { WebsiteBrochure } from '@/lib/types/website-content'
import type { PageFlip } from 'page-flip'

interface BrochurePreviewModalProps {
  brochure: WebsiteBrochure | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BrochurePreviewModal({ brochure, open, onOpenChange }: BrochurePreviewModalProps) {
  const bookRef = React.useRef<HTMLDivElement>(null)
  const flipRef = React.useRef<PageFlip | null>(null)
  const [ratio, setRatio] = React.useState(1.414)
  const [ready, setReady] = React.useState(false)
  const [page, setPage] = React.useState(0)

  const images = React.useMemo(() => brochure?.page_images ?? [], [brochure])
  const total = images.length

  // Measure the first page so the book keeps the PDF's aspect ratio instead of
  // guessing A4 and letterboxing every spread.
  React.useEffect(() => {
    if (!open || !images[0]) return
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (!cancelled && img.naturalWidth && img.naturalHeight) {
        setRatio(img.naturalHeight / img.naturalWidth)
      }
    }
    img.src = images[0]
    return () => {
      cancelled = true
    }
  }, [open, images])

  React.useEffect(() => {
    if (!open || total === 0) return

    let cancelled = false
    let flip: PageFlip | null = null

    // The dialog animates in; mounting page-flip against a container that is
    // still sized 0 gives a collapsed book, so wait a frame for layout.
    const start = window.setTimeout(() => {
      void (async () => {
        const { PageFlip } = await import('page-flip')
        if (cancelled || !bookRef.current) return

        const baseW = 500
        // Same configuration as the public viewer, so what staff approve is
        // what a visitor sees. showCover off: pages pair 1-2, 3-4 with no
        // blank leaf beside the cover.
        flip = new PageFlip(bookRef.current, {
          width: baseW,
          height: Math.round(baseW * ratio),
          size: 'stretch',
          minWidth: 315,
          maxWidth: 820,
          minHeight: Math.round(315 * ratio),
          maxHeight: Math.round(820 * ratio),
          usePortrait: true,
          maxShadowOpacity: 0.5,
          showCover: false,
          mobileScrollSupport: false,
          useMouseEvents: true,
          drawShadow: true,
        })
        flipRef.current = flip
        flip.loadFromImages(images)
        flip.on('flip', (e: { data: number }) => {
          if (!cancelled) setPage(e.data)
        })
        if (!cancelled) setReady(true)
      })()
    }, 60)

    return () => {
      cancelled = true
      window.clearTimeout(start)
      try {
        flip?.destroy?.()
      } catch {
        /* the book may already be gone with the dialog */
      }
      flipRef.current = null
      setReady(false)
      setPage(0)
    }
  }, [open, images, total, ratio])

  const prev = React.useCallback(() => flipRef.current?.flipPrev?.(), [])
  const next = React.useCallback(() => flipRef.current?.flipNext?.(), [])

  React.useEffect(() => {
    if (!open || !ready) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, ready, prev, next])

  if (!brochure) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[92vh] w-[96vw] max-w-[1400px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1400px]"
        showCloseButton={false}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900">
          <div className="min-w-0">
            <DialogTitle className="truncate text-base font-semibold text-slate-900 dark:text-white">
              {brochure.title}
            </DialogTitle>
            <p className="truncate text-xs text-muted-foreground">
              Staff preview · nothing is tracked and no lead is created
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {total > 0 && (
              <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
                {Math.min(page + 1, total)}–{Math.min(page + 2, total)} of {total}
              </span>
            )}
            {brochure.pdf_url && (
              <Button variant="outline" size="sm" asChild>
                <a href={brochure.pdf_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  PDF
                </a>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              onClick={() => onOpenChange(false)}
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="relative flex flex-1 min-h-0 items-center justify-center overflow-hidden bg-slate-100 p-4 dark:bg-slate-900">
          {total === 0 ? (
            // Only happens before the automatic pre-render has reached this
            // brochure. Rendering the PDF here as well would duplicate that
            // pipeline for a preview nobody is blocked on.
            <div className="max-w-sm text-center">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Pages are still being prepared
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                This brochure hasn&apos;t been pre-rendered yet. Leave the Brochures page open
                for a minute and it will finish on its own, then the preview will work here.
              </p>
              {brochure.pdf_url && (
                <Button variant="outline" size="sm" className="mt-3" asChild>
                  <a href={brochure.pdf_url} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Open the PDF instead
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <>
              {!ready && <Skeleton className="absolute inset-8 rounded-xl" />}

              <button
                type="button"
                onClick={prev}
                disabled={!ready || page === 0}
                className="absolute left-3 z-10 rounded-full bg-white/90 p-2 shadow-md transition disabled:opacity-30 dark:bg-slate-800/90"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div ref={bookRef} className="h-full w-full" />

              <button
                type="button"
                onClick={next}
                disabled={!ready || page >= total - 2}
                className="absolute right-3 z-10 rounded-full bg-white/90 p-2 shadow-md transition disabled:opacity-30 dark:bg-slate-800/90"
                aria-label="Next page"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
