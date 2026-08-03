'use client'

import * as React from 'react'
import { Settings2, AlertTriangle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/lib/hooks/use-toast'
import { useSavePricingSettings } from '@/lib/hooks/useWebsitePricing'
import type { PricingSettings, PricingSettingsInput, ProgrammeKey } from '@/lib/types/website-content'
import { ContentDialog, FormSection, Field, FieldRow } from './_form'

const PROGRAMME_LABEL: Record<string, string> = {
  residency: 'Summer Residency',
  university: 'University',
  gapyear: 'Gap Year',
}

// Per-programme deposit default + advanced card-fee settings. `settings` may be
// null (row not yet created) — we upsert on save.
export function PricingSettingsModal({
  open, programme, settings, onClose,
}: {
  open: boolean
  programme: ProgrammeKey
  settings: PricingSettings | null
  onClose: () => void
}) {
  const save = useSavePricingSettings()

  const [depositEnabled, setDepositEnabled] = React.useState(true)
  const [depositDefault, setDepositDefault] = React.useState('')
  const [feePercent, setFeePercent] = React.useState('') // shown as %, stored as decimal
  const [feeFixed, setFeeFixed] = React.useState('')
  const [showAdvanced, setShowAdvanced] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setDepositEnabled(settings?.deposit_enabled ?? true)
    setDepositDefault(settings?.deposit_default != null ? String(settings.deposit_default) : '')
    setFeePercent(settings?.fee_rate != null ? String(+(settings.fee_rate * 100).toFixed(4)) : '3.5')
    setFeeFixed(settings?.fee_fixed != null ? String(settings.fee_fixed) : '0.20')
    setShowAdvanced(false)
  }, [open, settings])

  async function submit() {
    if (depositEnabled && depositDefault.trim() === '') {
      toast({ title: 'Missing deposit', description: 'Enter a default deposit, or turn deposits off.', variant: 'destructive' })
      return
    }
    const pct = Number(feePercent)
    if (feePercent.trim() !== '' && (Number.isNaN(pct) || pct < 0 || pct >= 100)) {
      toast({ title: 'Invalid card fee', description: 'Card fee % must be between 0 and 100.', variant: 'destructive' })
      return
    }

    const payload: PricingSettingsInput = {
      programme,
      deposit_enabled: depositEnabled,
      deposit_default: depositDefault.trim() === '' ? null : Math.round(Number(depositDefault)),
      fee_rate: feePercent.trim() === '' ? 0 : +(pct / 100).toFixed(6),
      fee_fixed: feeFixed.trim() === '' ? 0 : Number(feeFixed),
    }

    try {
      await save.mutateAsync(payload)
      toast({ title: 'Settings saved', description: 'Live on the website within about a minute.' })
      onClose()
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    }
  }

  return (
    <ContentDialog
      open={open}
      onClose={onClose}
      icon={Settings2}
      accent="slate"
      title={`${PROGRAMME_LABEL[programme] ?? programme} — deposit & fees`}
      description="The default deposit for this programme, and (advanced) the card processing fee."
      onSubmit={submit}
      submitLabel="Save settings"
      saving={save.isPending}
    >
      <FormSection title="Deposit">
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/70 bg-muted/30 p-3">
          <Switch checked={depositEnabled} onCheckedChange={setDepositEnabled} />
          <span>
            <span className="block text-sm font-medium text-foreground">
              {depositEnabled ? 'Deposits enabled' : 'No deposits'}
            </span>
            <span className="block text-xs text-muted-foreground">
              {depositEnabled ? 'Customers can pay a deposit to secure their place.' : 'This programme takes no online deposit (e.g. Gap Year).'}
            </span>
          </span>
        </label>
        {depositEnabled && (
          <Field label="Default deposit (£)" hint="Used for every package in this programme unless a package overrides it.">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">£</span>
              <Input type="number" min={0} className="h-9 w-40" value={depositDefault} onChange={(e) => setDepositDefault(e.target.value)} placeholder="2000" />
            </div>
          </Field>
        )}
      </FormSection>

      <FormSection>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-sm font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {showAdvanced ? 'Hide advanced' : 'Advanced — card processing fee'}
        </button>
        {showAdvanced && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>The card fee is added on top of every charge so IFG receives the full amount. Changing it affects <strong>all</strong> payments for this programme. Default: 3.5% + £0.20.</span>
            </div>
            <FieldRow>
              <Field label="Card fee (%)" hint="e.g. 3.5">
                <Input type="number" min={0} max={99} step="0.1" value={feePercent} onChange={(e) => setFeePercent(e.target.value)} placeholder="3.5" />
              </Field>
              <Field label="Card fee fixed (£)" hint="e.g. 0.20">
                <Input type="number" min={0} step="0.01" value={feeFixed} onChange={(e) => setFeeFixed(e.target.value)} placeholder="0.20" />
              </Field>
            </FieldRow>
          </div>
        )}
      </FormSection>
    </ContentDialog>
  )
}
