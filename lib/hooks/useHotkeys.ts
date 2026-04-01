'use client'

import { useEffect, useCallback } from 'react'

type HotkeyHandler = (e: KeyboardEvent) => void

interface HotkeyConfig {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  handler: HotkeyHandler
  /** If true, also fires when inside inputs/textareas */
  allowInInput?: boolean
}

export function useHotkeys(hotkeys: HotkeyConfig[]) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      for (const hotkey of hotkeys) {
        if (!hotkey || !hotkey.key) continue
        if (!hotkey.allowInInput && isInput) continue

        const keyMatch = e.key?.toLowerCase() === hotkey.key.toLowerCase()
        const ctrlMatch = hotkey.ctrl ? (e.ctrlKey || e.metaKey) : true
        const shiftMatch = hotkey.shift ? e.shiftKey : true

        // For simple keys (no modifier), skip if ctrl/meta is pressed (to avoid hijacking browser shortcuts)
        if (!hotkey.ctrl && !hotkey.meta && (e.ctrlKey || e.metaKey)) continue

        if (keyMatch && ctrlMatch && shiftMatch) {
          e.preventDefault()
          hotkey.handler(e)
          return
        }
      }
    },
    [hotkeys]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
