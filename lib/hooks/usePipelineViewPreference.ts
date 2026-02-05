'use client'

import { useCallback, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'ifg-crm-pipeline-view-mode'
export type ViewMode = 'kanban' | 'list'

function getSnapshot(): ViewMode {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'list' || saved === 'kanban') {
    return saved
  }
  return 'kanban'
}

function getServerSnapshot(): ViewMode {
  return 'kanban'
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

export function usePipelineViewPreference() {
  const viewMode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setViewMode = useCallback((mode: ViewMode) => {
    localStorage.setItem(STORAGE_KEY, mode)
    // Dispatch storage event to trigger re-render
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
  }, [])

  return { viewMode, setViewMode, isLoaded: true }
}
