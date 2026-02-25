'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useHotkeys } from '@/lib/hooks/useHotkeys'
import { KeyboardShortcutsDialog } from '@/components/ui/keyboard-shortcuts-dialog'

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [helpOpen, setHelpOpen] = useState(false)
  const [goPending, setGoPending] = useState(false)

  // Handle "G then X" navigation sequences
  const handleGoKey = useCallback(() => {
    setGoPending(true)
    const timeout = setTimeout(() => setGoPending(false), 1500)

    const handler = (e: KeyboardEvent) => {
      clearTimeout(timeout)
      setGoPending(false)
      document.removeEventListener('keydown', handler)

      switch (e.key.toLowerCase()) {
        case 'd': router.push('/dashboard'); break
        case 'c': router.push('/contacts'); break
        case 'p': router.push('/pipelines'); break
        case 's': router.push('/settings'); break
        default: break
      }
    }

    document.addEventListener('keydown', handler, { once: true })
    return () => {
      clearTimeout(timeout)
      document.removeEventListener('keydown', handler)
    }
  }, [router])

  useHotkeys([
    {
      key: '/',
      handler: () => {
        // Focus the first search input on the page
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]'
        )
        if (searchInput) searchInput.focus()
      },
    },
    {
      key: '?',
      shift: true,
      handler: () => setHelpOpen(true),
    },
    {
      key: 'Escape',
      handler: () => setHelpOpen(false),
      allowInInput: true,
    },
    {
      key: 'g',
      handler: () => { handleGoKey() },
    },
  ])

  return (
    <>
      {children}
      <KeyboardShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
      {goPending && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-1.5 rounded-lg text-sm font-medium shadow-lg z-50 animate-in fade-in duration-150">
          Press: <kbd className="font-mono mx-0.5">D</kbd>ashboard, <kbd className="font-mono mx-0.5">C</kbd>ontacts, <kbd className="font-mono mx-0.5">P</kbd>ipelines, <kbd className="font-mono mx-0.5">S</kbd>ettings
        </div>
      )}
    </>
  )
}
