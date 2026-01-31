'use client'

import { useState, useEffect, useCallback } from 'react'

export type SortOption = 'value-desc' | 'value-asc' | 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'activity-desc'

export interface ColumnPreferences {
  collapsedColumns: string[]
  sortBy: Record<string, SortOption>
  // Future: filters per column
}

const STORAGE_KEY_PREFIX = 'kanban-column-prefs-'

function getStorageKey(pipelineId: string): string {
  return `${STORAGE_KEY_PREFIX}${pipelineId}`
}

const defaultPreferences: ColumnPreferences = {
  collapsedColumns: [],
  sortBy: {},
}

export function useColumnPreferences(pipelineId: string | null) {
  const [preferences, setPreferences] = useState<ColumnPreferences>(defaultPreferences)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (!pipelineId) {
      setPreferences(defaultPreferences)
      setIsLoaded(true)
      return
    }

    try {
      const stored = localStorage.getItem(getStorageKey(pipelineId))
      if (stored) {
        const parsed = JSON.parse(stored) as ColumnPreferences
        setPreferences(parsed)
      } else {
        setPreferences(defaultPreferences)
      }
    } catch {
      setPreferences(defaultPreferences)
    }
    setIsLoaded(true)
  }, [pipelineId])

  // Save preferences to localStorage
  const savePreferences = useCallback(
    (newPrefs: ColumnPreferences) => {
      if (!pipelineId) return
      try {
        localStorage.setItem(getStorageKey(pipelineId), JSON.stringify(newPrefs))
      } catch {
        // Ignore storage errors
      }
    },
    [pipelineId]
  )

  // Toggle column collapsed state
  const toggleColumnCollapsed = useCallback(
    (columnId: string) => {
      setPreferences((prev) => {
        const isCollapsed = prev.collapsedColumns.includes(columnId)
        const newCollapsed = isCollapsed
          ? prev.collapsedColumns.filter((id) => id !== columnId)
          : [...prev.collapsedColumns, columnId]
        const newPrefs = { ...prev, collapsedColumns: newCollapsed }
        savePreferences(newPrefs)
        return newPrefs
      })
    },
    [savePreferences]
  )

  // Check if a column is collapsed
  const isColumnCollapsed = useCallback(
    (columnId: string): boolean => {
      return preferences.collapsedColumns.includes(columnId)
    },
    [preferences.collapsedColumns]
  )

  // Set sort option for a column
  const setColumnSort = useCallback(
    (columnId: string, sort: SortOption) => {
      setPreferences((prev) => {
        const newSortBy = { ...prev.sortBy, [columnId]: sort }
        const newPrefs = { ...prev, sortBy: newSortBy }
        savePreferences(newPrefs)
        return newPrefs
      })
    },
    [savePreferences]
  )

  // Get sort option for a column
  const getColumnSort = useCallback(
    (columnId: string): SortOption => {
      return preferences.sortBy[columnId] || 'date-desc'
    },
    [preferences.sortBy]
  )

  return {
    preferences,
    isLoaded,
    toggleColumnCollapsed,
    isColumnCollapsed,
    setColumnSort,
    getColumnSort,
  }
}
