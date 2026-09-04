import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
})

/** Programmes that have their own Terms & Conditions. */
export type TermsProgramme = 'residency' | 'university' | 'gapyear'

export interface TermsRef {
  programme: TermsProgramme
  /** Version of the terms that was live when this payment was started. */
  version: number
  /** Public URL of the terms, for the link on the Stripe page. */
  url: string
}

/**
 * Create a Stripe Checkout Session with Terms & Conditions acceptance.
 *
 * Every payment in the CRM goes through here rather than calling
 * `stripe.checkout.sessions.create` directly, so no payment route can ship
 * without the tick box — there are four of them and a fifth would otherwise
 * be one forgotten line away from taking money with no terms agreed.
 *
 * `consent_collection.terms_of_service: 'required'` puts a mandatory tick box
 * on the Stripe payment page and refuses the payment until it is ticked.
 * Stripe records the acceptance on the session (`consent.terms_of_service`).
 *
 * The version is stamped into metadata because Stripe records only THAT the
 * customer agreed, not what they agreed to. Terms get rewritten; without the
 * version, a payment taken today cannot be tied to the wording that was on
 * screen when it was made — which is the whole point of collecting consent.
 *
 * With no terms published for the programme, the tick box still appears and
 * links to the Terms of Service URL configured in the Stripe Dashboard.
 */
export async function createCheckoutSession(
  params: Stripe.Checkout.SessionCreateParams,
  terms?: TermsRef | null,
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    ...params,
    consent_collection: { terms_of_service: 'required' },
    ...(terms && {
      custom_text: {
        ...params.custom_text,
        terms_of_service_acceptance: {
          message: `I have read and agree to the [Terms & Conditions](${terms.url}).`,
        },
      },
    }),
    metadata: {
      ...params.metadata,
      ...(terms && {
        terms_programme: terms.programme,
        terms_version: String(terms.version),
      }),
    },
  })
}
