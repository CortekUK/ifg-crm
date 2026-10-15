'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { BookOpen, FileText, Loader2, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTemplates } from '@/lib/hooks/useTemplates'
import { useBrochures } from '@/lib/hooks/useWebsiteBrochures'

/**
 * Picking a template or a brochure to send from the mailbox.
 *
 * Both exist already and neither could be reached from here, so a recruiter
 * writing to one player by hand could not send the same thing a campaign
 * sends to a hundred — they retyped it, worse, every time.
 *
 * A brochure is inserted as a LINK to the gated /b/<slug> page, never as an
 * attachment. The files run to 160MB against Outlook's 25MB ceiling, and the
 * gate is what captures the lead; attaching the PDF would fail and would lose
 * the reason the brochures exist.
 */

export interface Picked {
  id: string
  name: string
}

function Panel({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <span className="text-sm font-medium text-slate-200">{title}</span>
        <button onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-slate-200">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-72 overflow-y-auto">{children}</div>
    </div>
  )
}

export function TemplatePicker({
  onPick,
  onClose,
}: {
  onPick: (picked: Picked, subject: string | null) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const { data: templates = [], isLoading } = useTemplates()

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return templates
      // A draft is unfinished by definition — sending one to a parent is not
      // a thing anyone means to do.
      .filter((t) => !t.is_draft)
      .filter((t) =>
        !term ||
        (t.name ?? '').toLowerCase().includes(term) ||
        (t.subject ?? '').toLowerCase().includes(term),
      )
  }, [templates, search])

  return (
    <Panel title="Send a template" onClose={onClose}>
      <div className="border-b border-slate-800 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates"
            className="h-8 border-slate-800 bg-slate-950/60 pl-8 text-sm text-slate-100"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 px-3 py-4 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading templates…
        </p>
      ) : rows.length === 0 ? (
        <p className="px-3 py-4 text-xs text-slate-500">No template matches that.</p>
      ) : (
        rows.map((t) => (
          <button
            key={t.id}
            onClick={() => onPick({ id: t.id, name: t.name ?? 'Template' }, t.subject ?? null)}
            className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-slate-800"
          >
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-slate-100">{t.name}</p>
              {t.subject && <p className="truncate text-[11px] text-slate-500">{t.subject}</p>}
            </div>
            {t.category && (
              <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] capitalize text-slate-400">
                {t.category}
              </span>
            )}
          </button>
        ))
      )}
    </Panel>
  )
}

export function BrochurePicker({
  onPick,
  onClose,
}: {
  onPick: (picked: Picked) => void
  onClose: () => void
}) {
  const { data: brochures = [], isLoading } = useBrochures()

  // Only brochures whose pages are ready. Sending a link to one still being
  // prepared gives the reader a blank book.
  const rows = brochures.filter((b) => b.render_status === 'ready' && b.slug)

  return (
    <Panel title="Attach a brochure" onClose={onClose}>
      {isLoading ? (
        <p className="flex items-center gap-2 px-3 py-4 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading brochures…
        </p>
      ) : rows.length === 0 ? (
        <p className="px-3 py-4 text-xs text-slate-500">
          No brochure is ready to send yet.
        </p>
      ) : (
        <>
          {rows.map((b) => (
            <button
              key={b.id}
              onClick={() => onPick({ id: b.id, name: b.title ?? 'Brochure' })}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-800"
            >
              <div className="h-10 w-8 shrink-0 overflow-hidden rounded border border-slate-700 bg-slate-800">
                {b.cover_image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.cover_image} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-100">{b.title}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {b.page_count ? `${b.page_count} pages · ` : ''}/b/{b.slug}
                </p>
              </div>
              {!b.published && (
                <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                  Not live
                </span>
              )}
            </button>
          ))}
          <p className="border-t border-slate-800 px-3 py-2 text-[11px] text-slate-500">
            Sent as a link to the online brochure — the reader gives their details to open it,
            and that lands in the CRM.
          </p>
        </>
      )}
    </Panel>
  )
}

/** The chip shown once something is attached. */
export function AttachedChip({
  icon: Icon,
  label,
  onRemove,
}: {
  icon: React.ElementType
  label: string
  onRemove: () => void
}) {
  return (
    <span className={cn('flex items-center gap-1.5 rounded-full bg-slate-800 py-0.5 pl-2 pr-1.5 text-xs text-slate-200')}>
      <Icon className="h-3 w-3 text-slate-400" />
      <span className="max-w-[180px] truncate">{label}</span>
      <button onClick={onRemove} aria-label={`Remove ${label}`} className="text-slate-500 hover:text-slate-200">
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

export { BookOpen, FileText }
