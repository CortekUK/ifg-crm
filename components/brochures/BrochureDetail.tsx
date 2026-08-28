'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen,
  Copy,
  Eye,
  Download,
  Users,
  Search,
  Loader2,
  Plus,
  X,
  ExternalLink,
  ListChecks,
  Megaphone,
  GitBranch,
} from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  useBrochureAudience,
  useSetBrochureLists,
  useSetBrochureCampaigns,
  useSetBrochurePipelines,
} from '@/lib/hooks/useWebsiteBrochures'
import type { WebsiteBrochure, BrochureStats } from '@/lib/types/website-content'
import { brochurePublicUrl, copyToClipboard } from './shared'
import { BrochurePreviewModal } from './BrochurePreviewModal'

// ── Reference data (association pickers) ─────────────────────────────────────
type NamedRow = { id: string; name: string }
type StageRow = { id: string; name: string; pipeline_id: string; stage_type: string }

function useNamedTable(table: 'lists' | 'campaigns' | 'pipelines') {
  return useQuery<NamedRow[]>({
    queryKey: ['brochure-ref', table],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase.from(table).select('id, name').order('name')
      if (error) throw error
      return (data ?? []) as NamedRow[]
    },
  })
}

function usePipelineStages() {
  return useQuery<StageRow[]>({
    queryKey: ['brochure-ref', 'pipeline_stages'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('id, name, pipeline_id, stage_type')
      if (error) throw error
      return (data ?? []) as StageRow[]
    },
  })
}

// ── Small building blocks ────────────────────────────────────────────────────
function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card p-4">
      <div className="mb-3 flex items-start gap-2.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="font-oswald text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function StatTile({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/70 bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <span className="text-xl font-semibold tabular-nums text-foreground">{value.toLocaleString()}</span>
    </div>
  )
}

/** Searchable, scrollable checkbox multi-select with a Save button. */
function MultiSelectSave({
  options,
  loading,
  initial,
  onSave,
  saving,
  emptyText,
  saveLabel,
}: {
  options: NamedRow[]
  loading: boolean
  initial: string[]
  onSave: (ids: string[]) => void
  saving: boolean
  emptyText: string
  saveLabel: string
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set(initial))
  const [query, setQuery] = React.useState('')

  // Re-sync when the source selection changes (e.g. drawer reopened).
  React.useEffect(() => {
    setSelected(new Set(initial))
  }, [initial])

  const dirty =
    selected.size !== initial.length || initial.some((id) => !selected.has(id))

  // Attached items float to the top. With 25 lists the ones already in use
  // were scattered through an alphabetical list and easy to miss — you had to
  // scroll to find out what a brochure was even wired to.
  //
  // Sorted against `initial`, not `selected`, so a row does not jump out from
  // under the cursor the moment you tick it.
  const attached = new Set(initial)
  const filtered = options
    .filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      const rank = Number(attached.has(b.id)) - Number(attached.has(a.id))
      return rank !== 0 ? rank : a.name.localeCompare(b.name)
    })

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (loading) return <Skeleton className="h-40 w-full rounded-lg" />

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="h-8 pl-8 text-sm"
        />
      </div>
      <div className="max-h-52 space-y-0.5 overflow-y-auto rounded-lg border border-border/70 p-1">
        {options.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">No matches.</p>
        ) : (
          filtered.map((o) => (
            <label
              key={o.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggle(o.id)} />
              <span className="truncate">{o.name}</span>
            </label>
          ))
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{selected.size} selected</span>
        <Button size="sm" disabled={!dirty || saving} onClick={() => onSave(Array.from(selected))}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}

// ── Pipeline association rows ────────────────────────────────────────────────
const STAGE_DEFAULT = '__default__' // represents stage_id = null (default Follow Up stage)

type PipeRow = { key: string; pipeline_id: string; stage_id: string | null }

function PipelineRows({
  pipelines,
  stages,
  loading,
  initial,
  onSave,
  saving,
}: {
  pipelines: NamedRow[]
  stages: StageRow[]
  loading: boolean
  initial: { pipeline_id: string; stage_id: string | null }[]
  onSave: (rows: { pipeline_id: string; stage_id: string | null }[]) => void
  saving: boolean
}) {
  const makeRows = React.useCallback(
    () => initial.map((r, i) => ({ key: `init-${i}`, ...r })),
    [initial],
  )
  const [rows, setRows] = React.useState<PipeRow[]>(makeRows)

  React.useEffect(() => {
    setRows(makeRows())
  }, [makeRows])

  const addRow = () =>
    setRows((r) => [
      ...r,
      { key: `new-${Date.now()}-${r.length}`, pipeline_id: pipelines[0]?.id ?? '', stage_id: null },
    ])

  const removeRow = (key: string) => setRows((r) => r.filter((x) => x.key !== key))

  const updateRow = (key: string, patch: Partial<PipeRow>) =>
    setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)))

  const valid = rows.every((r) => r.pipeline_id)

  if (loading) return <Skeleton className="h-24 w-full rounded-lg" />

  if (pipelines.length === 0) {
    return <p className="text-sm text-muted-foreground">No pipelines exist yet.</p>
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-center text-sm text-muted-foreground">
            No pipelines attached.
          </p>
        )}
        {rows.map((row) => {
          const stageOptions = stages.filter((s) => s.pipeline_id === row.pipeline_id)
          return (
            <div key={row.key} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                value={row.pipeline_id}
                onValueChange={(v) => updateRow(row.key, { pipeline_id: v, stage_id: null })}
              >
                <SelectTrigger className="w-full sm:flex-1">
                  <SelectValue placeholder="Pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={row.stage_id ?? STAGE_DEFAULT}
                onValueChange={(v) =>
                  updateRow(row.key, { stage_id: v === STAGE_DEFAULT ? null : v })
                }
              >
                <SelectTrigger className="w-full sm:flex-1">
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STAGE_DEFAULT}>Default (Follow Up)</SelectItem>
                  {stageOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-red-500"
                onClick={() => removeRow(row.key)}
                aria-label="Remove pipeline"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="mr-2 h-4 w-4" />
          Add pipeline
        </Button>
        <Button
          size="sm"
          disabled={!valid || saving}
          onClick={() =>
            onSave(rows.map((r) => ({ pipeline_id: r.pipeline_id, stage_id: r.stage_id })))
          }
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save pipelines
        </Button>
      </div>
    </div>
  )
}

// ── Detail drawer ────────────────────────────────────────────────────────────
export function BrochureDetail({
  brochure,
  stats,
  open,
  onClose,
}: {
  brochure: WebsiteBrochure | null
  stats: BrochureStats | undefined
  open: boolean
  onClose: () => void
}) {
  const brochureId = brochure?.id ?? null

  const [previewOpen, setPreviewOpen] = React.useState(false)
  const audienceQuery = useBrochureAudience(brochureId)
  const audience = audienceQuery.data ?? []
  // "Views" now means people, not opens — the brochure is gated, so the two
  // were always describing the same set from different angles.
  const totalDownloads = audience.reduce((n, m) => n + m.downloads, 0)

  const hasFastImages = (brochure?.page_images?.length ?? 0) > 0

  const listsRef = useNamedTable('lists')
  const campaignsRef = useNamedTable('campaigns')
  const pipelinesRef = useNamedTable('pipelines')
  const stagesRef = usePipelineStages()

  const setLists = useSetBrochureLists()
  const setCampaigns = useSetBrochureCampaigns()
  const setPipelines = useSetBrochurePipelines()

  const publicUrl = brochure ? brochurePublicUrl(brochure.slug) : ''

  const saveLists = async (ids: string[]) => {
    if (!brochureId) return
    try {
      await setLists.mutateAsync({ brochureId, listIds: ids })
      toast({ title: 'Lists updated' })
    } catch (err) {
      toast({ title: 'Could not update lists', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }
  const saveCampaigns = async (ids: string[]) => {
    if (!brochureId) return
    try {
      await setCampaigns.mutateAsync({ brochureId, campaignIds: ids })
      toast({ title: 'Campaigns updated' })
    } catch (err) {
      toast({ title: 'Could not update campaigns', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }
  const savePipelines = async (rows: { pipeline_id: string; stage_id: string | null }[]) => {
    if (!brochureId) return
    try {
      await setPipelines.mutateAsync({ brochureId, rows })
      toast({ title: 'Pipelines updated' })
    } catch (err) {
      toast({ title: 'Could not update pipelines', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        showCloseButton
        className="w-full gap-0 sm:max-w-xl"
      >
        {brochure && (
          <>
            {/* Header */}
            <div className="flex items-start gap-3 border-b border-border/70 p-4 pr-12">
              <div className="flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                {brochure.cover_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brochure.cover_image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-oswald text-lg font-semibold leading-tight text-foreground">
                  {brochure.title}
                </h2>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {brochure.page_count ? `${brochure.page_count} pages · ` : ''}/b/{brochure.slug}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {/* Overview */}
              <SectionCard icon={Eye} title="Overview">
                <div className="grid grid-cols-2 gap-2">
                  <StatTile icon={Eye} label="Views" value={audience.length} />
                  <StatTile icon={Download} label="Downloads" value={totalDownloads} />
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 p-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{publicUrl}</span>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Open public link"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(publicUrl)}>
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>

                {/* Preview here rather than "open the public link" — that page
                    is gated, so previewing it would put staff details into the
                    brochure's own lead list. */}
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => setPreviewOpen(true)}
                >
                  <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                  Preview the flipbook
                </Button>

                {!hasFastImages && (
                  <p className="mt-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    Pages are being pre-rendered so this opens quickly for visitors. Until that
                    finishes it falls back to loading the PDF itself, which is slower.
                  </p>
                )}
              </SectionCard>

              {/* One list of people. Each row carries how many times they
                  opened it, so a repeat reader reads as one person with a
                  count rather than inflating a separate "views" number. */}
              <SectionCard
                icon={Users}
                title="Views"
                description="Everyone who has opened this brochure, and how often."
              >
                {audienceQuery.isLoading ? (
                  <Skeleton className="h-24 w-full rounded-lg" />
                ) : audienceQuery.isError ? (
                  <p className="text-sm text-red-500">Could not load views.</p>
                ) : audience.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
                    Nobody has opened this brochure yet.
                  </p>
                ) : (
                  <div className="max-h-72 overflow-y-auto rounded-lg border border-border/70">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/60 text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Name</th>
                          <th className="px-3 py-2 text-left font-medium">Email</th>
                          <th className="px-3 py-2 text-center font-medium">Opens</th>
                          <th className="px-3 py-2 text-left font-medium">Last opened</th>
                        </tr>
                      </thead>
                      <tbody>
                        {audience.map((m) => (
                          <tr key={m.contact_id} className="border-t border-border/70">
                            <td className="px-3 py-2 text-foreground">
                              {[m.first_name, m.last_name].filter(Boolean).join(' ') || '—'}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{m.email || '—'}</td>
                            <td className="px-3 py-2 text-center">
                              <span className="tabular-nums text-foreground">{m.opens}</span>
                              {m.downloads > 0 && (
                                <Badge variant="outline" className="ml-1.5 text-[10px]">
                                  <Download className="mr-0.5 h-2.5 w-2.5" />
                                  {m.downloads}
                                </Badge>
                              )}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                              {new Date(m.last_seen).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>

              {/* Attached lists */}
              <SectionCard
                icon={ListChecks}
                title="Attached lists"
                description="Leads captured by this brochure are added to these lists."
              >
                <MultiSelectSave
                  options={listsRef.data ?? []}
                  loading={listsRef.isLoading}
                  initial={stats?.list_ids ?? []}
                  onSave={saveLists}
                  saving={setLists.isPending}
                  emptyText="No lists exist yet."
                  saveLabel="Save lists"
                />
              </SectionCard>

              {/* Attached campaigns */}
              <SectionCard
                icon={Megaphone}
                title="Attached campaigns"
                description="Associate this brochure with marketing campaigns."
              >
                <MultiSelectSave
                  options={campaignsRef.data ?? []}
                  loading={campaignsRef.isLoading}
                  initial={stats?.campaign_ids ?? []}
                  onSave={saveCampaigns}
                  saving={setCampaigns.isPending}
                  emptyText="No campaigns exist yet."
                  saveLabel="Save campaigns"
                />
              </SectionCard>

              {/* Attached pipelines */}
              <SectionCard
                icon={GitBranch}
                title="Attached pipelines"
                description="When a deal enters this stage, this brochure is emailed to the contact."
              >
                <PipelineRows
                  pipelines={pipelinesRef.data ?? []}
                  stages={stagesRef.data ?? []}
                  loading={pipelinesRef.isLoading || stagesRef.isLoading}
                  initial={stats?.pipelines ?? []}
                  onSave={savePipelines}
                  saving={setPipelines.isPending}
                />
              </SectionCard>
            </div>
          </>
        )}
      </SheetContent>

      {/* Preview lives outside SheetContent so the book gets the full window
          rather than the drawer's width. */}
      <BrochurePreviewModal
        brochure={brochure ?? null}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </Sheet>
  )
}

// Small chip used by the list rows on the page.
export function CountChip({ icon: Icon, count, label }: { icon: React.ElementType; count: number; label: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('gap-1 font-normal', count === 0 && 'opacity-60')}
      title={`${count} ${label}`}
    >
      <Icon className="h-3 w-3" />
      {count}
    </Badge>
  )
}
