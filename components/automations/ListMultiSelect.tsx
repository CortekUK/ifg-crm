'use client'

// Searchable multi-select for the "Static Lists" picker on the
// deal_creation / list_assignment automation templates. Replaces the old
// 2-column grid of checkboxes that became unusable once the lists table
// passed ~10 entries (especially with the pipeline-mirror lists added by
// migration 131, which can easily push the total past 30).
//
// What this fixes vs the old grid:
//   * Search box — type to narrow.
//   * Selected items pinned at the top as removable chips, so the user
//     never has to scroll back to see what's already selected. Pipeline-
//     mirror lists carry a small git-branch glyph on their chip so the
//     two kinds remain distinguishable at a glance without splitting the
//     body into separate sections.
//   * Single-column rows — easier to read names like "UCLAN MASTERS 2024"
//     than wrapping inside a half-width column.
//   * Larger scroll area (h-72) so 6–7 rows are visible at once.

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, X, GitBranch } from 'lucide-react'
import type { List } from '@/lib/types/lists'

interface ListMultiSelectProps {
  lists: List[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export function ListMultiSelect({ lists, selectedIds, onChange }: ListMultiSelectProps) {
  const [query, setQuery] = useState('')
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  // Lookup so the chip strip can render a name even if the list is
  // filtered out by the search query.
  const listById = useMemo(() => {
    const m = new Map<string, List>()
    for (const l of lists) m.set(l.id, l)
    return m
  }, [lists])

  // Single sorted, search-filtered list. We used to split this into
  // "Pipeline Lists" vs "Other Lists" but the separation added more
  // visual noise than value once the picker was searchable.
  const visibleLists = useMemo(() => {
    const q = query.trim().toLowerCase()
    return lists
      .filter((l) => !q || l.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [lists, query])

  const toggle = (id: string) => {
    onChange(selectedSet.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])
  }

  const selectAllVisible = () => {
    const ids = new Set(selectedIds)
    for (const l of visibleLists) ids.add(l.id)
    onChange([...ids])
  }

  const clearAll = () => onChange([])

  const totalSelected = selectedIds.length
  const totalVisible = visibleLists.length
  const allVisibleSelected =
    visibleLists.length > 0 && visibleLists.every((l) => selectedSet.has(l.id))

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40">
      {/* Selected chips strip — only when something is selected. */}
      {totalSelected > 0 && (
        <div className="px-3 pt-2.5 pb-2 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground mr-1">
            {totalSelected} selected
          </span>
          {selectedIds.map((id) => {
            const list = listById.get(id)
            if (!list) return null
            return (
              <Badge
                key={id}
                variant="secondary"
                className="gap-1 pl-2 pr-1 py-0.5 text-xs font-normal"
              >
                {list.source_pipeline_id && (
                  <GitBranch className="h-3 w-3 text-blue-500 shrink-0" />
                )}
                <span className="max-w-[180px] truncate">{list.name}</span>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="ml-0.5 rounded p-0.5 hover:bg-slate-300/60 dark:hover:bg-slate-600/60"
                  aria-label={`Remove ${list.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )
          })}
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto text-[11px] text-muted-foreground underline hover:text-slate-700 dark:hover:text-slate-200"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Search */}
      <div className="px-3 pt-2.5 pb-2 border-b border-slate-200 dark:border-slate-700">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${lists.length} list${lists.length === 1 ? '' : 's'}…`}
            className="h-8 pl-8 text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-700"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body — single flat list with a top action row for select-all
          / clear of the visible (search-filtered) results. */}
      {totalVisible > 0 && (
        <div className="px-3 py-1.5 flex items-center justify-end gap-3 border-b border-slate-200 dark:border-slate-700">
          {totalSelected > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-[10px] text-muted-foreground hover:text-red-600"
            >
              Clear all
            </button>
          )}
          {!allVisibleSelected && (
            <button
              type="button"
              onClick={selectAllVisible}
              className="text-[10px] text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              {query ? 'Select visible' : 'Select all'}
            </button>
          )}
        </div>
      )}

      <ScrollArea className="h-72">
        {totalVisible === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            {lists.length === 0
              ? 'No lists created yet. Create one from the Lists page.'
              : 'No lists match your search.'}
          </div>
        )}

        {visibleLists.map((list) => {
          const checked = selectedSet.has(list.id)
          return (
            <button
              key={list.id}
              type="button"
              onClick={() => toggle(list.id)}
              className={
                'w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors ' +
                (checked
                  ? 'bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100/60 dark:hover:bg-blue-950/50'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/40')
              }
            >
              <Checkbox checked={checked} onCheckedChange={() => toggle(list.id)} className="shrink-0" />
              <span className="flex-1 truncate">{list.name}</span>
              {typeof list.contact_count === 'number' && (
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                  {list.contact_count.toLocaleString()}
                </span>
              )}
            </button>
          )
        })}
      </ScrollArea>
    </div>
  )
}
