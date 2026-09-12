'use client'

import * as React from 'react'
import { Check, Plus, Search, Users, Tag as TagIcon, ChevronRight, Sparkles, Info } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  TAG_CATEGORY_LABEL,
  type Detection,
  type TagCategory,
} from '@/lib/utils/import-detect'

interface ListOption {
  id: string
  name: string
  contact_count?: number
}

interface Props {
  detection: Detection
  lists: ListOption[]
  /** Lists every contact in the file joins. */
  selectedListIds: string[]
  onSelectedListIds: (ids: string[]) => void
  /** Detected cohort name -> the list name to use, or null when switched off. */
  cohortLists: Record<string, string | null>
  onCohortLists: (next: Record<string, string | null>) => void
  tagCategories: Set<TagCategory>
  onTagCategories: (next: Set<TagCategory>) => void
  onCreateList: (name: string) => Promise<void>
}

const nf = new Intl.NumberFormat('en-GB')

/** Datalist id shared by every cohort input — one element, not one per row. */
const LIST_NAMES_ID = 'import-existing-list-names'

export function ImportRoutingStep({
  detection,
  lists,
  selectedListIds,
  onSelectedListIds,
  cohortLists,
  onCohortLists,
  tagCategories,
  onTagCategories,
  onCreateList,
}: Props) {
  const [search, setSearch] = React.useState('')
  const [creating, setCreating] = React.useState(false)

  const byLowerName = React.useMemo(
    () => new Map(lists.map((l) => [l.name.trim().toLowerCase(), l])),
    [lists],
  )

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = q ? lists.filter((l) => l.name.toLowerCase().includes(q)) : lists
    // Selected first, then biggest — the lists worth picking are the big ones.
    return [...rows].sort((a, b) => {
      const sa = selectedListIds.includes(a.id) ? 0 : 1
      const sb = selectedListIds.includes(b.id) ? 0 : 1
      return sa - sb || (b.contact_count ?? 0) - (a.contact_count ?? 0)
    })
  }, [lists, search, selectedListIds])

  const exactExists = byLowerName.has(search.trim().toLowerCase())
  const canCreate = search.trim().length > 1 && !exactExists

  const toggleList = (id: string) =>
    onSelectedListIds(
      selectedListIds.includes(id)
        ? selectedListIds.filter((x) => x !== id)
        : [...selectedListIds, id],
    )

  const handleCreate = async () => {
    const name = search.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      await onCreateList(name)
      setSearch('')
    } finally {
      setCreating(false)
    }
  }

  const setCohort = (detected: string, value: string | null) => {
    onCohortLists({ ...cohortLists, [detected]: value })
  }

  const toggleCategory = (c: TagCategory) => {
    const next = new Set(tagCategories)
    if (next.has(c)) next.delete(c)
    else next.add(c)
    onTagCategories(next)
  }

  const cohortOnCount = detection.cohortLists.filter((c) => cohortLists[c.name]).length

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      {/* One datalist for every cohort input: existing names autocomplete, and
          anything typed that doesn't match simply becomes a new list. */}
      <datalist id={LIST_NAMES_ID}>
        {lists.map((l) => (
          <option key={l.id} value={l.name} />
        ))}
      </datalist>

      {/* ---------------- Left: lists for the whole file ---------------- */}
      <section className="flex min-h-0 flex-col rounded-lg border border-border">
        <header className="border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-muted-foreground" />
            Add everyone to these lists
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Applies to all {nf.format(detection.totalRows)} contacts. Pick as many as you like.
          </p>
        </header>

        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canCreate) {
                  e.preventDefault()
                  void handleCreate()
                }
              }}
              placeholder="Search lists, or type a new name…"
              className="h-9 pl-8 text-sm"
            />
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="mt-2 flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Create list &ldquo;{search.trim()}&rdquo;
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">No lists match.</p>
          ) : (
            filtered.map((l) => {
              const on = selectedListIds.includes(l.id)
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggleList(l.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors',
                    on ? 'bg-primary/10' : 'hover:bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                    )}
                  >
                    {on && <Check className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{l.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {nf.format(l.contact_count ?? 0)}
                  </span>
                </button>
              )
            })
          )}
        </div>

        <footer className="flex items-start gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Everyone is added to <strong className="font-medium">ALL CONTACTS EVERYONE</strong>{' '}
            automatically, whatever you pick here.
          </span>
        </footer>
      </section>

      {/* ---------------- Right: detected from the data ---------------- */}
      <section className="flex min-h-0 flex-col rounded-lg border border-border">
        <header className="border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            Detected from the file
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Worked out per contact from their own row — nothing is created until you import.
          </p>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {/* ---- Cohort lists ---- */}
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Lists from gender &amp; graduation year
              </h4>
              {detection.cohortLists.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {cohortOnCount} of {detection.cohortLists.length} on
                </span>
              )}
            </div>

            {detection.cohortLists.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                No gender or graduation year found in this file.
                <br />
                Pick a list on the left like <strong>2027 MENS</strong> and both are read from its
                name instead.
              </p>
            ) : (
              <div className="space-y-1.5">
                {detection.cohortLists.map((c) => {
                  const value = cohortLists[c.name]
                  const on = value != null
                  const target = (value ?? c.name).trim().toLowerCase()
                  const isExisting = byLowerName.has(target)
                  return (
                    <div
                      key={c.name}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md border px-2.5 py-2 transition-colors',
                        on ? 'border-border bg-muted/30' : 'border-dashed border-border opacity-60',
                      )}
                    >
                      <Checkbox
                        checked={on}
                        onCheckedChange={(v) => setCohort(c.name, v ? c.name : null)}
                        aria-label={`Add contacts to ${c.name}`}
                      />
                      <input
                        list={LIST_NAMES_ID}
                        value={value ?? c.name}
                        disabled={!on}
                        onChange={(e) => setCohort(c.name, e.target.value)}
                        className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 py-1 text-sm outline-none transition-colors hover:border-input focus:border-primary disabled:cursor-not-allowed"
                      />
                      <Badge
                        variant={isExisting ? 'secondary' : 'outline'}
                        className="shrink-0 text-[10px] font-medium"
                      >
                        {isExisting ? 'existing' : 'new'}
                      </Badge>
                      <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        {nf.format(c.count)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ---- Tag categories ---- */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tags
            </h4>
            {detection.tags.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                Nothing taggable found in this file.
              </p>
            ) : (
              <div className="space-y-1.5">
                {detection.tags.map((g) => {
                  const on = tagCategories.has(g.category)
                  return (
                    <details
                      key={g.category}
                      className={cn(
                        'group rounded-md border transition-colors',
                        on ? 'border-border' : 'border-dashed border-border opacity-60',
                      )}
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-2.5 py-2 [&::-webkit-details-marker]:hidden">
                        <span onClick={(e) => e.preventDefault()}>
                          <Checkbox
                            checked={on}
                            onCheckedChange={() => toggleCategory(g.category)}
                            aria-label={`Apply ${TAG_CATEGORY_LABEL[g.category]} tags`}
                          />
                        </span>
                        <TagIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {TAG_CATEGORY_LABEL[g.category]}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {g.values.length} {g.values.length === 1 ? 'tag' : 'tags'} ·{' '}
                          {nf.format(g.rows)} rows
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                      </summary>
                      <div className="flex flex-wrap gap-1.5 border-t border-border px-2.5 py-2.5">
                        {g.values.slice(0, 40).map((v) => (
                          <Badge
                            key={v.name}
                            variant={byLowerName.has(v.name.toLowerCase()) ? 'secondary' : 'outline'}
                            className="gap-1.5 font-normal"
                          >
                            {v.name}
                            <span className="tabular-nums opacity-60">{nf.format(v.count)}</span>
                          </Badge>
                        ))}
                        {g.values.length > 40 && (
                          <Badge variant="outline" className="font-normal opacity-60">
                            +{g.values.length - 40} more
                          </Badge>
                        )}
                      </div>
                    </details>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
