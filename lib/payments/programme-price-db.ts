/**
 * Reading a programme's published price from the database, server-side.
 *
 * The browser copy of these rules lives in ./programme-pricing.ts and is what
 * the automation editor shows the admin. This is the copy that runs when a
 * deal is actually created, so the figure billed is the figure displayed.
 *
 * MIRROR: resolveProgrammePrice() in
 * supabase/functions/process-automations/index.ts does the same for the
 * invoice step, and supabase/functions/form-webhook/index.ts for deals created
 * by the edge function. Edge functions cannot import from lib/ — change them
 * together.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaymentProgramme } from './programmes'
import { programmeForFormId } from './programme-pricing'

export { programmeForFormId }

export type PriceMode = 'deposit' | 'full'

/**
 * The published deposit or full price for a programme, or null when it cannot
 * be decided.
 *
 * Null rather than a guess. A programme that publishes several prices — Gap
 * Year sells two seasons at £6,500 and £4,000 — has no single right answer
 * unless the automation names a package, and charging either one would be
 * wrong half the time. The caller falls back to its configured amount and the
 * editor shows the admin why.
 */
export async function resolveProgrammePriceFromDb(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  programme: PaymentProgramme | null,
  mode: PriceMode,
  packageKey?: string | null,
): Promise<number | null> {
  if (!programme) return null

  // 1. The programme-wide deposit. Residency and University sell one deposit
  //    for the whole programme; there is no programme-wide full price.
  if (mode === 'deposit') {
    const { data: settings } = await supabase
      .from('website_pricing_settings')
      .select('deposit_default, deposit_enabled')
      .eq('programme', programme)
      .maybeSingle()

    if (settings?.deposit_enabled) {
      const deposit = Number(settings.deposit_default)
      if (Number.isFinite(deposit) && deposit > 0) return deposit
    }
  }

  // 2. Per-package prices, for programmes that price by package instead.
  const { data: packages } = await supabase
    .from('website_packages')
    .select('key, deposit_amount, full_amount')
    .eq('programme', programme)
    .eq('published', true)
    .eq(mode === 'deposit' ? 'deposit_enabled' : 'full_enabled', true)

  type Row = { key: string; deposit_amount: number | null; full_amount: number | null }
  const priced = ((packages ?? []) as Row[])
    .map((pkg) => ({
      key: pkg.key,
      amount: Number(mode === 'deposit' ? pkg.deposit_amount : pkg.full_amount),
    }))
    .filter((pkg) => Number.isFinite(pkg.amount) && pkg.amount > 0)

  if (priced.length === 0) return null

  if (packageKey) {
    return priced.find((pkg) => pkg.key === packageKey)?.amount ?? null
  }

  const amounts = [...new Set(priced.map((pkg) => pkg.amount))]
  return amounts.length === 1 ? amounts[0] : null
}

/**
 * The value a new deal should carry, for a deal-creation automation.
 *
 * Falls back to the hand-typed `default_deal_value` whenever the published
 * price cannot be resolved, so a programme with no published price still
 * creates deals rather than failing — the old behaviour, kept as a floor.
 */
export async function resolveNewDealValue(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  config: {
    deal_value_source?: 'programme_deposit' | 'programme_full' | 'custom'
    deal_value_package_key?: string
    default_deal_value?: number
  } | null | undefined,
  formId: string | null | undefined,
): Promise<number> {
  const fallback = Number(config?.default_deal_value ?? 0) || 0
  const source = config?.deal_value_source ?? 'programme_deposit'
  if (source === 'custom') return fallback

  const resolved = await resolveProgrammePriceFromDb(
    supabase,
    programmeForFormId(formId),
    source === 'programme_full' ? 'full' : 'deposit',
    config?.deal_value_package_key ?? null,
  )
  return resolved ?? fallback
}
