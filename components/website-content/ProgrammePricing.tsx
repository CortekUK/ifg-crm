'use client'

import * as React from 'react'
import { Plus, Pencil, Trash2, Loader2, Star, Settings2, PoundSterling } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/hooks/use-toast'
import { usePackages, usePricingSettings, useDeletePackage } from '@/lib/hooks/useWebsitePricing'
import type { WebsitePackage, PricingSettings, ProgrammeKey } from '@/lib/types/website-content'
import { PackageModal } from './PackageModal'
import { PricingSettingsModal } from './PricingSettingsModal'
import { DeleteConfirm } from './_shared'

const gbp = (n: number) => `£${n.toLocaleString('en-GB')}`
const feeText = (s?: PricingSettings) => (s ? `${+(s.fee_rate * 100).toFixed(2)}% + ${gbp(s.fee_fixed)}` : '3.5% + £0.20')

function PackageRow({
  pkg, deposit, onEdit, onDelete, deleting,
}: {
  pkg: WebsitePackage
  deposit: number | null
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <div className={cn('flex items-center gap-3 rounded-lg border border-border/70 bg-card p-3', !pkg.published && 'opacity-70')}>
      <span title={pkg.key} className="flex h-9 min-w-[36px] max-w-[92px] shrink-0 items-center justify-center overflow-hidden truncate whitespace-nowrap rounded-md bg-muted px-2 text-xs font-semibold uppercase text-muted-foreground">{pkg.key}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{pkg.label}</p>
          {pkg.featured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              <Star className="h-2.5 w-2.5" />Featured
            </span>
          )}
          {!pkg.published && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">Draft</span>}
        </div>
        {pkg.subtitle && <p className="truncate text-xs text-muted-foreground">{pkg.subtitle}</p>}
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        <p className="text-sm font-semibold text-foreground">{pkg.full_enabled && pkg.full_amount != null ? gbp(pkg.full_amount) : '—'}</p>
        <p className="text-[11px] text-muted-foreground">{pkg.deposit_enabled ? (deposit != null ? `${gbp(deposit)} deposit` : 'no deposit set') : 'no deposit'}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button onClick={onEdit} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
        <button onClick={onDelete} disabled={deleting} className="rounded-md p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40" aria-label="Delete">
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

// Pricing editor for a SINGLE programme (embedded in that programme's page).
export function ProgrammePricingEditor({ programme }: { programme: ProgrammeKey }) {
  const packages = usePackages()
  const settings = usePricingSettings()
  const del = useDeletePackage()

  const [pkgModal, setPkgModal] = React.useState<{ open: boolean; item: WebsitePackage | null; defaultSort: number }>({ open: false, item: null, defaultSort: 0 })
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [target, setTarget] = React.useState<{ id: string; label: string } | null>(null)

  const s = settings.data?.find((x) => x.programme === programme) ?? null
  const list = (packages.data ?? []).filter((x) => x.programme === programme)
  const effectiveDeposit = (pkg: WebsitePackage) => pkg.deposit_amount ?? (s?.deposit_enabled ? s.deposit_default : null) ?? null

  async function confirmDelete() {
    if (!target) return
    const id = target.id
    setTarget(null)
    setDeletingId(id)
    try {
      await del.mutateAsync(id)
      toast({ title: 'Package deleted', description: 'Removed from the website.' })
    } catch (e) {
      toast({ title: 'Delete failed', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  const loading = packages.isLoading || settings.isLoading

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-3 border-b border-border/70 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
            <PoundSterling className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-oswald text-base font-semibold text-slate-900 dark:text-white">Packages &amp; pricing</h3>
            <p className="text-xs text-muted-foreground">
              {s?.deposit_enabled && s.deposit_default != null ? <>Deposit <strong>{gbp(s.deposit_default)}</strong></> : <>No deposit</>}
              {' · '}Card fee {feeText(s ?? undefined)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}><Settings2 className="mr-2 h-4 w-4" />Deposit &amp; fees</Button>
          <Button size="sm" onClick={() => setPkgModal({ open: true, item: null, defaultSort: list.length })}><Plus className="mr-2 h-4 w-4" />Add package</Button>
        </div>
      </div>

      <div className="space-y-2 p-4">
        {loading ? (
          <>{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</>
        ) : list.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
            No packages yet — the website shows its built-in prices until you add one.
          </p>
        ) : (
          list.map((pkg) => (
            <PackageRow key={pkg.id} pkg={pkg} deposit={effectiveDeposit(pkg)}
              onEdit={() => setPkgModal({ open: true, item: pkg, defaultSort: pkg.sort_order })}
              onDelete={() => setTarget({ id: pkg.id, label: pkg.label })} deleting={deletingId === pkg.id} />
          ))
        )}
      </div>

      <PackageModal open={pkgModal.open} programme={programme} item={pkgModal.item} defaultSort={pkgModal.defaultSort}
        onClose={() => setPkgModal((m) => ({ ...m, open: false }))} />
      <PricingSettingsModal open={settingsOpen} programme={programme} settings={s} onClose={() => setSettingsOpen(false)} />
      <DeleteConfirm target={target} onCancel={() => setTarget(null)} onConfirm={confirmDelete} />
    </section>
  )
}

const PROGRAMME_LABELS: Record<ProgrammeKey, string> = {
  residency: 'Summer Residency',
  university: 'University',
  gapyear: 'Gap Year',
}

// The dedicated Programme Pricing page — packages + deposit/fees for every
// programme in one place. Pricing is money-critical and managed separately
// from page content.
export function AllProgrammePricing() {
  const programmes: ProgrammeKey[] = ['residency', 'university', 'gapyear']
  return (
    <div className="space-y-8">
      {programmes.map((p) => (
        <section key={p} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-5 w-1.5 rounded-full bg-emerald-500" />
            <h2 className="font-oswald text-xl font-semibold uppercase tracking-tight text-slate-900 dark:text-white">{PROGRAMME_LABELS[p]}</h2>
          </div>
          <ProgrammePricingEditor programme={p} />
        </section>
      ))}
    </div>
  )
}
