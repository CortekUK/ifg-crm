'use client'

// Automatically pre-render page images for any brochure that lacks them.
//
// Brochures uploaded through the modal are pre-rendered at upload time; this
// closes the gap for everything that predates that, without anyone having to
// press a button.
//
// Runs in the admin's browser because rasterising a PDF server-side would need
// a native canvas binary in the deployment. One brochure at a time: a 46-page
// render is heavy, and doing three at once would lock up the tab.

import { useEffect, useRef, useState } from 'react'
import { generateBrochurePageImages } from '@/lib/website-content/brochure-images'
import { useSaveBrochure } from '@/lib/hooks/useWebsiteBrochures'
import type { WebsiteBrochure } from '@/lib/types/website-content'

/** A stalled CDN read must not leave the banner spinning forever. */
const FETCH_TIMEOUT_MS = 120_000

export interface AutoImageProgress {
  brochureId: string | null
  title: string | null
  status: string | null
  /** Brochures still queued behind this one. */
  pending: number
}

const IDLE: AutoImageProgress = { brochureId: null, title: null, status: null, pending: 0 }

export function useAutoBrochureImages(
  brochures: WebsiteBrochure[],
  enabled: boolean,
): AutoImageProgress {
  const saveBrochure = useSaveBrochure()
  const [progress, setProgress] = useState<AutoImageProgress>(IDLE)

  // Ids already attempted this session. A failure must not retry on every
  // render — an unreachable or corrupt PDF would loop forever.
  const attempted = useRef<Set<string>>(new Set())
  const running = useRef(false)

  // Everything the loop needs is read through refs. The previous version had
  // `saveBrochure` in the dependency array; useMutation returns a new object
  // every render, so the effect re-ran constantly, each cleanup cancelled the
  // in-flight loop, and the cancelled branch skipped resetting progress — which
  // left the "Speeding up…" banner spinning indefinitely.
  const latest = useRef(brochures)
  latest.current = brochures
  const save = useRef(saveBrochure)
  save.current = saveBrochure

  // Cancellation is tied to unmount alone, never to a dependency change.
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // Stable across refetches: only the set of brochures still needing work.
  // Re-entry is harmless — `running` keeps it to one loop.
  const pendingKey = brochures
    .filter((b) => !!b.pdf_url && (b.page_images?.length ?? 0) === 0)
    .map((b) => b.id)
    .sort()
    .join(',')

  useEffect(() => {
    if (!enabled || !pendingKey || running.current) return

    const needsImages = (b: WebsiteBrochure) =>
      !!b.pdf_url && (b.page_images?.length ?? 0) === 0 && !attempted.current.has(b.id)

    running.current = true

    void (async () => {
      try {
        for (;;) {
          if (!alive.current) return
          const queue = latest.current.filter(needsImages)
          const brochure = queue[0]
          if (!brochure) break

          attempted.current.add(brochure.id)
          setProgress({
            brochureId: brochure.id,
            title: brochure.title,
            status: 'Preparing…',
            pending: queue.length - 1,
          })

          try {
            const { urls, pageCount } = await generateBrochurePageImages(
              brochure.pdf_url as string,
              (status) => {
                if (alive.current) setProgress((p) => ({ ...p, status }))
              },
              FETCH_TIMEOUT_MS,
            )
            if (!alive.current) return

            await save.current.mutateAsync({
              ...brochure,
              page_images: urls,
              cover_image: brochure.cover_image || urls[0] || null,
              page_count: pageCount,
            })
          } catch (err) {
            // Quiet on purpose: background housekeeping nobody asked for, and a
            // failure just leaves the slower PDF fallback in place.
            console.error(`Could not pre-render "${brochure.title}":`, err)
          }
        }
      } finally {
        running.current = false
        // Always clear, even when the loop bailed — a stuck banner is worse
        // than no banner.
        if (alive.current) setProgress(IDLE)
      }
    })()
  }, [enabled, pendingKey])

  return progress
}
