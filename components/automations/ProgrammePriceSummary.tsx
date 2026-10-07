'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertTriangle } from 'lucide-react'
import { formatGBP, type ResolvedPrice } from '@/lib/payments/programme-pricing'

/**
 * The published figure an automation will actually use, shown rather than
 * described.
 *
 * Both Deal Creation and Invoice Generation ask the same question — "what is
 * this programme's price?" — and both used to answer it with an empty number
 * box. An admin typing £100 had no way to tell it disagreed with the £2,000
 * the website was charging the same player. This renders the resolved amount,
 * and asks which package when a programme publishes several.
 */
export function ProgrammePriceSummary({
  price,
  packageKey,
  onPackageKeyChange,
  fallbackLabel,
}: {
  price: ResolvedPrice
  packageKey: string | undefined
  onPackageKeyChange: (key: string) => void
  /** What gets used instead when nothing resolves, named for the caller's field. */
  fallbackLabel: string
}) {
  return (
    <div className="space-y-2">
      {price.choices.length > 1 && (
        <div className="space-y-2">
          <Label>
            Which package? <span className="text-destructive">*</span>
          </Label>
          <Select value={packageKey || ''} onValueChange={onPackageKeyChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a package" />
            </SelectTrigger>
            <SelectContent>
              {price.choices.map((choice) => (
                <SelectItem key={choice.key} value={choice.key}>
                  {choice.label} — {formatGBP(choice.amount)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            This programme publishes more than one price, and nothing on a deal records
            which one a player chose, so the automation has to name it.
          </p>
        </div>
      )}

      {price.amount !== null ? (
        <div className="rounded-md border border-green-600/30 bg-green-50 p-3 dark:bg-green-900/20">
          <p className="text-sm font-medium text-green-900 dark:text-green-200">
            {formatGBP(price.amount)}
          </p>
          <p className="mt-1 text-xs text-green-800/80 dark:text-green-200/70">
            The same amount a player pays on the website. Change it under Website &rarr;
            Pricing and this follows, with nothing to re-type here.
          </p>
        </div>
      ) : (
        <p className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            {price.reason} Until this resolves, {fallbackLabel}
          </span>
        </p>
      )}
    </div>
  )
}
