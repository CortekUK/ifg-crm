import type { TermsProgramme } from '@/lib/stripe'

/**
 * The website-payable programmes, in one place.
 *
 * Both the public deposit route (which adds a contact to the abandoned list
 * when they open Stripe) and the Stripe webhook (which removes them on
 * payment) read the abandoned-list name from here, so the two can never drift
 * apart — they used to be two separate university-or-else ternaries, which
 * would have filed every Gap Year payer under Summer.
 */
export type PaymentProgramme = TermsProgramme

export interface PaymentProgrammeMeta {
  /** Display name on invoices and Stripe line items. */
  name: string
  /** form_id the programme's form-submission automation listens for; used to
   *  resolve its pipeline at runtime (no hardcoded pipeline ids). */
  formId: string
  abandonedList: { name: string; description: string }
}

export const PAYMENT_PROGRAMMES: Record<PaymentProgramme, PaymentProgrammeMeta> = {
  residency: {
    name: 'Summer Residency',
    formId: 'summer',
    abandonedList: {
      name: 'Abandoned Summer Deposits',
      description: 'Started the Summer Residency deposit/payment checkout on the website but have not paid yet — follow up.',
    },
  },
  university: {
    name: 'University Programme',
    formId: 'university',
    abandonedList: {
      name: 'Abandoned University Deposits',
      description: 'Started the University Programme deposit/payment checkout on the website but have not paid yet — follow up.',
    },
  },
  gapyear: {
    name: 'Gap Year Programme',
    formId: 'gapyear',
    abandonedList: {
      name: 'Abandoned Gap Year Deposits',
      description: 'Started the Gap Year deposit/payment checkout on the website but have not paid yet — follow up.',
    },
  },
}

export function isPaymentProgramme(key: unknown): key is PaymentProgramme {
  return typeof key === 'string' && key in PAYMENT_PROGRAMMES
}

/**
 * Extra questions on the Stripe Checkout page. Stripe allows at most three:
 * player name, gender and graduation year. Gender + graduation year are what
 * the cohort routing (lib/forms/lead-routing.ts) needs to file the player into
 * "ALL MENS" / "2027 MENS" etc., exactly as a website form lead would be.
 * The webhook's enrichContactFromCheckout() reads them back by these keys.
 */
export const CHECKOUT_PLAYER_NAME_KEY = 'playername'
export const CHECKOUT_GENDER_KEY = 'playergender'
export const CHECKOUT_GRAD_YEAR_KEY = 'graduationyear'

/** Graduation years offered: a few already graduated (university-age players)
 *  through to younger players still at school. */
function graduationYearOptions(now = new Date().getFullYear()) {
  const years: { label: string; value: string }[] = []
  for (let y = now - 8; y <= now + 5; y++) years.push({ label: String(y), value: String(y) })
  return years
}

export function checkoutCustomFields() {
  return [
    {
      key: CHECKOUT_PLAYER_NAME_KEY,
      label: { type: 'custom' as const, custom: 'Player full name' },
      type: 'text' as const,
      optional: false,
    },
    {
      key: CHECKOUT_GENDER_KEY,
      label: { type: 'custom' as const, custom: 'Player gender' },
      type: 'dropdown' as const,
      dropdown: { options: [{ label: 'Male', value: 'male' }, { label: 'Female', value: 'female' }] },
      optional: false,
    },
    {
      key: CHECKOUT_GRAD_YEAR_KEY,
      label: { type: 'custom' as const, custom: 'Player graduation year (high school)' },
      type: 'dropdown' as const,
      dropdown: { options: graduationYearOptions() },
      optional: false,
    },
  ]
}
