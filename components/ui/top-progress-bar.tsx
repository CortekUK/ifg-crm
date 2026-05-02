'use client'

// Thin animated progress bar at the very top of the viewport, NextTopLoader-
// style. Two trigger sources:
//
//   1. Internal link clicks — captured at the document level so it covers
//      every Link / <a href="/…"> click regardless of where it renders. We
//      ignore external links, modified clicks, target=_blank, and same-page
//      anchors.
//
//   2. Pathname / search-param changes — when the new page actually mounts,
//      we close the bar. This second leg is what stops the bar even when
//      the navigation was started by something other than a link click
//      (router.push, form action, etc.).
//
// State machine: idle → trickling (after click) → finishing (on pathname
// change) → idle. We use a CSS transition on `width` so it animates smoothly
// without per-frame React renders.

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// Tuned for the "feels fast" range — the bar starts at 8% so the user
// immediately sees motion, trickles up to ~80% during navigation, then
// snaps to 100% and fades when the new page mounts.
const STAGE_INITIAL = 8
const STAGE_TRICKLE_CAP = 80
const COLOR_FROM = '#6366f1' // indigo-500
const COLOR_TO = '#a855f7' // purple-500

export function TopProgressBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastKeyRef = useRef<string | null>(null)

  // Start a trickle that creeps toward 80%. Stops the previous trickle
  // first so multiple link clicks don't double up.
  const start = () => {
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current)
    if (trickleRef.current) clearInterval(trickleRef.current)
    setVisible(true)
    setProgress(STAGE_INITIAL)
    trickleRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= STAGE_TRICKLE_CAP) return p
        // Slower as it gets closer to the cap, like NProgress.
        const remaining = STAGE_TRICKLE_CAP - p
        const step = Math.max(0.5, remaining * 0.06)
        return Math.min(STAGE_TRICKLE_CAP, p + step)
      })
    }, 220)
  }

  const finish = () => {
    if (trickleRef.current) {
      clearInterval(trickleRef.current)
      trickleRef.current = null
    }
    setProgress(100)
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current)
    fadeTimeoutRef.current = setTimeout(() => {
      setVisible(false)
      setProgress(0)
    }, 280)
  }

  // Source 1: capture link clicks at the document level.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Skip modified clicks (cmd/ctrl/shift/alt) — those open in new tab.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      if (e.button !== 0) return

      const target = e.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a')
      if (!anchor) return

      // Only trigger for internal navigations.
      const href = anchor.getAttribute('href')
      if (!href) return
      if (anchor.target === '_blank') return
      if (href.startsWith('http://') || href.startsWith('https://')) {
        try {
          const url = new URL(href, window.location.href)
          if (url.origin !== window.location.origin) return
        } catch {
          return
        }
      }
      if (href.startsWith('mailto:') || href.startsWith('tel:')) return
      if (href.startsWith('#')) return
      // Same path, same query — no navigation, don't show the bar.
      const here = window.location.pathname + window.location.search
      if (href === here) return

      start()
    }
    document.addEventListener('click', onClick, { capture: true })
    return () => {
      document.removeEventListener('click', onClick, { capture: true })
    }
  }, [])

  // Source 1b: form submissions.
  //
  // We do NOT check defaultPrevented here. React 19 form actions
  // (<form action={fn}>) call preventDefault internally so they can run
  // the action client-side — exactly the case where we DO want a progress
  // bar (login / signup / etc.). The 4-second safety timeout handles
  // submit-handler-driven forms that don't navigate (validation, dialogs)
  // — they get a brief bar that winds down on its own.
  //
  // Forms that legitimately should not show the bar (e.g. inline filter
  // forms inside a list page) can opt out via data-no-progress="true".
  useEffect(() => {
    const onSubmit = (e: Event) => {
      const form = e.target
      if (!(form instanceof HTMLFormElement)) return
      if (form.dataset.noProgress === 'true') return
      start()
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current)
      fadeTimeoutRef.current = setTimeout(() => {
        finish()
      }, 4000)
    }
    document.addEventListener('submit', onSubmit)
    return () => {
      document.removeEventListener('submit', onSubmit)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Source 2: pathname / search-param changes finish the bar. We track the
  // last "key" we saw so initial mount doesn't trigger finish().
  useEffect(() => {
    const key = `${pathname}?${searchParams?.toString() ?? ''}`
    if (lastKeyRef.current === null) {
      lastKeyRef.current = key
      return
    }
    if (lastKeyRef.current !== key) {
      lastKeyRef.current = key
      finish()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (trickleRef.current) clearInterval(trickleRef.current)
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current)
    }
  }, [])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100]"
      style={{ height: 3 }}
    >
      <div
        className="h-full origin-left"
        style={{
          width: `${progress}%`,
          background: `linear-gradient(90deg, ${COLOR_FROM} 0%, ${COLOR_TO} 100%)`,
          boxShadow: visible
            ? `0 0 10px ${COLOR_FROM}, 0 0 5px ${COLOR_FROM}`
            : 'none',
          opacity: visible ? 1 : 0,
          transition:
            'width 220ms ease-out, opacity 280ms ease-out, box-shadow 220ms ease-out',
        }}
      />
    </div>
  )
}
