/**
 * Resolving a programme's published price from a pipeline.
 *
 * One deposit, one home. The website charges what the CMS publishes under
 * Website → Pricing; an invoice raised by dragging a card to Send Invoice must
 * charge the same figure, or the two drift the moment somebody edits one. They
 * already had: the Residency deposit moved £1,000 → £2,000 on the website while
 * the invoice automation carried a hand-typed £100.
 *
 * MIRROR: resolveProgrammeDeposit() in
 * supabase/functions/process-automations/index.ts applies the same rules at
 * send time. Edge functions cannot import from lib/, so the logic is stated
 * twice — change both together. This copy exists so the automation editor can
 * show the admin the exact figure that will be billed, rather than asking them
 * to trust it.
 */

import { PAYMENT_PROGRAMMES, type PaymentProgramme } from './programmes'
import type { Automation } from '@/lib/types/automations'
import type { WebsitePackage, PricingSettings } from '@/lib/types/website-content'

/** form_id → programme key, derived from PAYMENT_PROGRAMMES so it can't drift. */
export const FORM_ID_TO_PROGRAMME: Record<string, PaymentProgramme> = Object.fromEntries(
  (Object.keys(PAYMENT_PROGRAMMES) as PaymentProgramme[]).map((key) => [
    PAYMENT_PROGRAMMES[key].formId,
    key,
  ]),
)

/**
 * Which programme a pipeline sells.
 *
 * There is no programme column on pipelines. The link is the one the public
 * deposit route already uses: a programme's form-submission automation names
 * the pipeline its leads land in. Resolved at runtime rather than from
 * hardcoded pipeline ids.
 */
export function programmeForPipeline(
  pipelineId: string | null | undefined,
  automations: Automation[],
): PaymentProgramme | null {
  if (!pipelineId) return null
  for (const a of automations) {
    if (a.trigger_type !== 'form_submission' || !a.is_active) continue
    if (a.pipeline_id !== pipelineId) continue
    const formId = a.config?.form_id
    if (formId && FORM_ID_TO_PROGRAMME[formId]) return FORM_ID_TO_PROGRAMME[formId]
  }
  return null
}

export type PriceMode = 'deposit' | 'full'

export interface PricingChoice {
  /** website_packages.key, or '' for the programme-wide deposit. */
  key: string
  label: string
  amount: number
}

/**
 * Every published figure the admin could pick for this programme.
 *
 * Residency and University publish a single programme-wide deposit, so this
 * returns one option with an empty key. Gap Year publishes a deposit per
 * season, so it returns one per package and the automation has to name which.
 */
export function pricingChoices(
  programme: PaymentProgramme | null,
  mode: PriceMode,
  packages: WebsitePackage[],
  settings: PricingSettings[],
): PricingChoice[] {
  if (!programme) return []

  if (mode === 'deposit') {
    const setting = settings.find((s) => s.programme === programme)
    const programmeWide = Number(setting?.deposit_default)
    if (setting?.deposit_enabled && Number.isFinite(programmeWide) && programmeWide > 0) {
      return [{ key: '', label: 'Programme deposit', amount: programmeWide }]
    }
  }

  return packages
    .filter((p) => p.programme === programme && p.published)
    .filter((p) => (mode === 'deposit' ? p.deposit_enabled : p.full_enabled))
    .map((p) => ({
      key: p.key,
      label: p.label,
      amount: Number(mode === 'deposit' ? p.deposit_amount : p.full_amount),
    }))
    .filter((c) => Number.isFinite(c.amount) && c.amount > 0)
}

export interface ResolvedPrice {
  amount: number | null
  /** Why no amount, phrased for an admin reading it in the editor. */
  reason: string | null
  /** Set when the admin must pick, because several figures are published. */
  choices: PricingChoice[]
}

/**
 * The figure an invoice would actually be raised for, given the automation's
 * configuration. Never guesses between several published amounts — it reports
 * the choice instead, so the editor can ask rather than bill the wrong season.
 */
export function resolveProgrammePrice(
  programme: PaymentProgramme | null,
  mode: PriceMode,
  packageKey: string | undefined,
  packages: WebsitePackage[],
  settings: PricingSettings[],
): ResolvedPrice {
  if (!programme) {
    return {
      amount: null,
      reason:
        'No active form-submission automation ties this pipeline to a programme, so there is no published price to read.',
      choices: [],
    }
  }

  const choices = pricingChoices(programme, mode, packages, settings)
  const noun = mode === 'deposit' ? 'deposit' : 'full price'

  if (choices.length === 0) {
    return {
      amount: null,
      reason: `${PAYMENT_PROGRAMMES[programme].name} has no published ${noun} under Website → Pricing.`,
      choices: [],
    }
  }

  if (choices.length === 1) return { amount: choices[0].amount, reason: null, choices }

  const picked = choices.find((c) => c.key === packageKey)
  if (picked) return { amount: picked.amount, reason: null, choices }

  return {
    amount: null,
    reason: `${PAYMENT_PROGRAMMES[programme].name} publishes ${choices.length} different ${noun}s. Choose which one this pipeline bills.`,
    choices,
  }
}

/** £2,000 — no trailing .00 on whole pounds, which every IFG price is. */
export function formatGBP(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
