'use client'

// Inline entity reference rendered inside Scout's markdown replies. The model
// emits e.g. `[Khan](scout-entity:contact:UUID)` and ScoutMarkdown's <a>
// override mounts this component instead of a plain link.
//
// Behaviour:
//   - underlined, badge-coloured chip showing the label
//   - hover (or focus) opens a HoverCard that lazy-fetches details from
//     /api/scout/entity once, then caches them per-mount
//   - clicking opens the corresponding CRM page in a new tab

import { useState } from 'react'
import Link from 'next/link'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { cn } from '@/lib/utils'
import {
  User,
  GitBranch,
  ReceiptPoundSterling,
  Zap,
  ListIcon,
  Layers,
  UserCog,
  ExternalLink,
  Loader2,
} from 'lucide-react'

type EntityType =
  | 'contact'
  | 'deal'
  | 'invoice'
  | 'automation'
  | 'list'
  | 'pipeline'
  | 'user'

interface EntityDetail {
  type: EntityType
  id: string
  title: string
  subtitle: string | null
  facts: [string, string][]
  href: string
}

// `route` is the CRM page we navigate to when the chip is clicked. It mirrors
// the `href` returned by /api/scout/entity, but is hard-coded here so the chip
// is clickable instantly without waiting for the hover-card fetch.
const TYPE_META: Record<
  EntityType,
  { icon: typeof User; label: string; tint: string; route: string }
> = {
  contact: { icon: User, label: 'Contact', tint: 'text-violet-600 dark:text-violet-300', route: '/contacts' },
  deal: { icon: GitBranch, label: 'Deal', tint: 'text-fuchsia-600 dark:text-fuchsia-300', route: '/pipelines' },
  invoice: { icon: ReceiptPoundSterling, label: 'Invoice', tint: 'text-emerald-600 dark:text-emerald-300', route: '/invoices' },
  automation: { icon: Zap, label: 'Automation', tint: 'text-amber-600 dark:text-amber-300', route: '/automations' },
  list: { icon: ListIcon, label: 'List', tint: 'text-sky-600 dark:text-sky-300', route: '/lists' },
  pipeline: { icon: Layers, label: 'Pipeline', tint: 'text-indigo-600 dark:text-indigo-300', route: '/pipelines' },
  user: { icon: UserCog, label: 'User', tint: 'text-slate-600 dark:text-slate-300', route: '/users' },
}

export function ScoutEntityRef({
  type,
  id,
  label,
}: {
  type: EntityType
  id: string
  label: string
}) {
  const meta = TYPE_META[type] ?? TYPE_META.contact
  const [detail, setDetail] = useState<EntityDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const ensureLoaded = async () => {
    if (detail || loading) return
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch(`/api/scout/entity?type=${type}&id=${id}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const data = (await res.json()) as EntityDetail
      setDetail(data)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }

  const Icon = meta.icon

  return (
    <HoverCard openDelay={200} closeDelay={120}>
      <HoverCardTrigger asChild>
        <a
          href={detail?.href ?? meta.route}
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={ensureLoaded}
          onFocus={ensureLoaded}
          className={cn(
            'inline-flex cursor-pointer items-center gap-1 rounded px-1 py-px font-medium underline decoration-dotted underline-offset-2 transition',
            meta.tint,
            'hover:bg-slate-100 dark:hover:bg-slate-800',
          )}
        >
          <Icon className="h-3 w-3" />
          {label}
        </a>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        sideOffset={6}
        className="w-72 p-0 text-sm"
      >
        <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
          <div className="flex items-center gap-1.5">
            <Icon className={cn('h-3.5 w-3.5', meta.tint)} />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {meta.label}
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm font-semibold text-slate-900 dark:text-white">
            {detail?.title ?? label}
          </p>
          {detail?.subtitle && (
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {detail.subtitle}
            </p>
          )}
        </div>
        <div className="px-3 py-2">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
            </div>
          )}
          {err && (
            <p className="text-xs text-red-600 dark:text-red-400">{err}</p>
          )}
          {!loading && !err && detail && detail.facts.length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              {detail.facts.map(([k, v], i) => (
                <div key={i} className="contents">
                  <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
                  <dd className="truncate text-slate-800 dark:text-slate-100">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {!loading && !err && detail && (
            <Link
              href={detail.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-fuchsia-600 hover:underline dark:text-fuchsia-300"
            >
              Open in CRM <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

// Parse a `scout-entity:type:uuid` URI scheme. Returns null on any malformed
// input so the markdown renderer can fall back to a normal link.
export function parseEntityHref(href: string | undefined):
  | { type: EntityType; id: string }
  | null {
  if (!href || !href.startsWith('scout-entity:')) return null
  const rest = href.slice('scout-entity:'.length)
  const colon = rest.indexOf(':')
  if (colon < 1) return null
  const type = rest.slice(0, colon) as EntityType
  const id = rest.slice(colon + 1)
  const valid: EntityType[] = [
    'contact', 'deal', 'invoice', 'automation', 'list', 'pipeline', 'user',
  ]
  if (!valid.includes(type)) return null
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null
  }
  return { type, id }
}
