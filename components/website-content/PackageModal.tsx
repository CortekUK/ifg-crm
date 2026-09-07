'use client'

import * as React from 'react'
import { Tag, Plus, Trash2, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/hooks/use-toast'
import { useSavePackage } from '@/lib/hooks/useWebsitePricing'
import type { WebsitePackage, WebsitePackageInput, PriceLine, ItineraryDay, ProgrammeKey } from '@/lib/types/website-content'
import { ContentDialog, FormSection, Field, FieldRow, PublishControls } from './_form'

const PROGRAMME_LABEL: Record<string, string> = {
  residency: 'Summer Residency',
  university: 'University',
  gapyear: 'Gap Year',
}

// One editable package. `programme` fixes which programme it belongs to (set by
// the Add button / the item being edited); it is never changed here.
export function PackageModal({
  open, programme, item, defaultSort, onClose,
}: {
  open: boolean
  programme: ProgrammeKey
  item: WebsitePackage | null
  defaultSort?: number
  onClose: () => void
}) {
  const save = useSavePackage()

  const [key, setKey] = React.useState('')
  const [label, setLabel] = React.useState('')
  const [subtitle, setSubtitle] = React.useState('')
  const [duration, setDuration] = React.useState('')
  const [fullEnabled, setFullEnabled] = React.useState(true)
  const [fullAmount, setFullAmount] = React.useState('')
  const [depositEnabled, setDepositEnabled] = React.useState(true)
  const [depositAmount, setDepositAmount] = React.useState('')
  const [breakdown, setBreakdown] = React.useState<PriceLine[]>([])
  const [itinerary, setItinerary] = React.useState<ItineraryDay[]>([])
  const [featured, setFeatured] = React.useState(false)
  const [published, setPublished] = React.useState(true)
  const [sortOrder, setSortOrder] = React.useState('0')

  // Load the item (or reset for a new one) each time the modal opens.
  React.useEffect(() => {
    if (!open) return
    setKey(item?.key ?? '')
    setLabel(item?.label ?? '')
    setSubtitle(item?.subtitle ?? '')
    setDuration(item?.duration ?? '')
    setFullEnabled(item?.full_enabled ?? true)
    setFullAmount(item?.full_amount != null ? String(item.full_amount) : '')
    setDepositEnabled(item?.deposit_enabled ?? true)
    setDepositAmount(item?.deposit_amount != null ? String(item.deposit_amount) : '')
    setBreakdown(item?.breakdown?.length ? item.breakdown : [])
    setItinerary(item?.itinerary?.length ? item.itinerary : [])
    setFeatured(item?.featured ?? false)
    setPublished(item?.published ?? true)
    setSortOrder(String(item?.sort_order ?? defaultSort ?? 0))
  }, [open, item, defaultSort])

  const setLine = (i: number, patch: Partial<PriceLine>) =>
    setBreakdown((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const addLine = () => setBreakdown((rows) => [...rows, { label: '', value: '' }])
  const removeLine = (i: number) => setBreakdown((rows) => rows.filter((_, idx) => idx !== i))

  const setDay = (i: number, patch: Partial<ItineraryDay>) =>
    setItinerary((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const addDay = () => setItinerary((rows) => [...rows, { date: '', activity: '' }])
  const removeDay = (i: number) => setItinerary((rows) => rows.filter((_, idx) => idx !== i))
  const moveDay = (i: number, by: number) =>
    setItinerary((rows) => {
      const to = i + by
      if (to < 0 || to >= rows.length) return rows
      const next = [...rows]
      ;[next[i], next[to]] = [next[to], next[i]]
      return next
    })

  async function submit() {
    const k = key.trim()
    const l = label.trim()
    if (!k || !l) {
      toast({ title: 'Missing details', description: 'A key and a label are required.', variant: 'destructive' })
      return
    }
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(k)) {
      toast({ title: 'Invalid key', description: 'Use letters, numbers, - or _ (e.g. A or full-season).', variant: 'destructive' })
      return
    }
    if (fullEnabled && fullAmount.trim() === '') {
      toast({ title: 'Missing price', description: 'Enter a full price, or turn off "Payable in full".', variant: 'destructive' })
      return
    }

    const payload: WebsitePackageInput = {
      ...(item ? { id: item.id } : {}),
      programme,
      key: k,
      label: l,
      subtitle: subtitle.trim() || null,
      duration: duration.trim() || null,
      full_amount: fullAmount.trim() === '' ? null : Math.round(Number(fullAmount)),
      deposit_amount: depositAmount.trim() === '' ? null : Math.round(Number(depositAmount)),
      deposit_enabled: depositEnabled,
      full_enabled: fullEnabled,
      breakdown: breakdown.filter((ln) => ln.label.trim() || ln.value.trim()),
      itinerary: itinerary.filter((d) => d.date.trim() || d.activity.trim()),
      featured,
      published,
      sort_order: Number(sortOrder) || 0,
    }

    try {
      await save.mutateAsync(payload)
      toast({ title: item ? 'Package updated' : 'Package added', description: 'Live on the website within about a minute.' })
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      toast({
        title: 'Save failed',
        description: /duplicate|unique/i.test(msg) ? `A package with key "${k}" already exists for this programme.` : msg,
        variant: 'destructive',
      })
    }
  }

  return (
    <ContentDialog
      open={open}
      onClose={onClose}
      icon={Tag}
      accent="emerald"
      title={item ? 'Edit package' : 'Add package'}
      description={`${PROGRAMME_LABEL[programme] ?? programme} · pricing shown on the website and charged at checkout`}
      onSubmit={submit}
      submitLabel={item ? 'Save package' : 'Add package'}
      saving={save.isPending}
    >
      <FormSection title="Package">
        <FieldRow>
          <Field label="Key" required hint="Stable id, e.g. A or full-season.">
            <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="A" />
          </Field>
          <Field label="Label" required hint="e.g. Full 6 Weeks">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Full 6 Weeks" />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Subtitle" hint="Dates or season, e.g. June 20th – Aug 1st">
            <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="June 20th – Aug 1st" />
          </Field>
          <Field label="Duration" hint="e.g. 6 weeks">
            <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="6 weeks" />
          </Field>
        </FieldRow>
      </FormSection>

      <FormSection title="Pricing">
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>These amounts are what customers are <strong>charged at checkout</strong> (plus the card fee). Enter whole pounds — e.g. 8000 for £8,000.</span>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/30 p-3">
          <label className="flex cursor-pointer items-center gap-3">
            <Switch checked={fullEnabled} onCheckedChange={setFullEnabled} />
            <span className="text-sm font-medium">Payable in full</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">£</span>
            <Input
              type="number" min={0} className="h-9 w-32" value={fullAmount}
              onChange={(e) => setFullAmount(e.target.value)} placeholder="8000" disabled={!fullEnabled}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/30 p-3">
          <label className="flex cursor-pointer items-center gap-3">
            <Switch checked={depositEnabled} onCheckedChange={setDepositEnabled} />
            <span className="text-sm font-medium">Deposit accepted</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">£</span>
            <Input
              type="number" min={0} className="h-9 w-32" value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)} placeholder="Programme default" disabled={!depositEnabled}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Leave the deposit blank to use the programme’s default deposit. Set a value only to override this one package.</p>
      </FormSection>

      <FormSection title="Breakdown lines">
        <p className="text-xs text-muted-foreground">Optional detail shown under the package (University &amp; Gap Year), e.g. Accommodation — £6,500.</p>
        <div className="space-y-2">
          {breakdown.map((line, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={line.label} onChange={(e) => setLine(i, { label: e.target.value })} placeholder="Accommodation" />
              <Input value={line.value} onChange={(e) => setLine(i, { value: e.target.value })} placeholder="£6,500" className="w-32" />
              <Button type="button" variant="outline" size="icon" onClick={() => removeLine(i)} aria-label="Remove line">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="mr-2 h-4 w-4" />Add line
          </Button>
        </div>
      </FormSection>

      <FormSection title="Day-by-day schedule">
        <p className="text-xs text-muted-foreground">
          The dates for this block, shown on the programme page. Leave empty and no
          schedule is shown for it.
        </p>
        <div className="space-y-2">
          {itinerary.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <Input
                value={d.date}
                onChange={(e) => setDay(i, { date: e.target.value })}
                placeholder="Monday June 28th"
              />
              <Input
                value={d.activity}
                onChange={(e) => setDay(i, { activity: e.target.value })}
                placeholder="Training"
                className="w-44"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => moveDay(i, -1)} disabled={i === 0} aria-label="Move up">
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={() => moveDay(i, 1)} disabled={i === itinerary.length - 1} aria-label="Move down">
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={() => removeDay(i)} aria-label="Remove day">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addDay}>
            <Plus className="mr-2 h-4 w-4" />Add day
          </Button>
        </div>
      </FormSection>

      <FormSection title="Visibility">
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/70 bg-muted/30 p-3">
          <Switch checked={featured} onCheckedChange={setFeatured} />
          <span>
            <span className="block text-sm font-medium text-foreground">Featured</span>
            <span className="block text-xs text-muted-foreground">Highlighted as “Most popular” / “Best value”.</span>
          </span>
        </label>
        <PublishControls
          published={published}
          onPublishedChange={setPublished}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
        />
      </FormSection>
    </ContentDialog>
  )
}
