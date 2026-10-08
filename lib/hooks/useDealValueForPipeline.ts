import { useCallback } from 'react'
import { useAutomations } from '@/lib/hooks/useAutomations'
import { usePackages, usePricingSettings } from '@/lib/hooks/useWebsitePricing'
import { programmeForPipeline, resolveProgrammePrice } from '@/lib/payments/programme-pricing'

/**
 * What a deal created from an inbound reply should be worth.
 *
 * QA-32 bug 2 was raised against Smart Deal, which hard-coded £0: a player who
 * replied to a campaign landed on the board worth nothing beside £12,000 and
 * £15,000 deals, dragging down the pipeline total and every conversion report
 * until somebody edited each card by hand.
 *
 * The same hard-coded zero also sits in the single Match dialog's optional
 * "create a deal" path, which QA-32 never exercised. Rather than copy the
 * resolution into a second component and let the two drift, both now call
 * this. It reads the programme's published deposit — the same figure the
 * form-submission path and the invoice automations use — so a lead is worth
 * the same however it arrived.
 *
 * WHERE A PROGRAMME PUBLISHES MORE THAN ONE DEPOSIT
 *
 * resolveProgrammePrice refuses to choose, by design: it is shared with the
 * invoice editor, and guessing between £6,500 and £4,000 there would bill a
 * real player the wrong amount (see migration 197). But returning its `null`
 * straight to the board puts us back on £0, which is what this hook exists to
 * fix — and UK GAP 2027 is exactly that case, so Gap Year leads would still
 * have been created worthless.
 *
 * A deal value is a forecast on a card, not an invoice; nobody is charged by
 * it. So where the programme publishes several deposits we take its primary
 * package — `featured` first, then `sort_order` — which is the same package
 * migration 197 chose for Gap Year invoicing and the one the CMS presents as
 * the headline price. Being roughly right on a forecast beats being certainly
 * wrong at zero, and the card is editable.
 */
export function useDealValueForPipeline(): (pipelineId: string) => number {
  const { data: allAutomations = [] } = useAutomations()
  const { data: websitePackages = [] } = usePackages()
  const { data: pricingSettings = [] } = usePricingSettings()

  return useCallback(
    (pipelineId: string): number => {
      const programme = programmeForPipeline(pipelineId, allAutomations)
      const price = resolveProgrammePrice(
        programme,
        'deposit',
        undefined,
        websitePackages,
        pricingSettings,
      )
      if (price.amount != null) return price.amount

      // Several published deposits and no package named — take the primary one.
      if (programme && price.choices.length > 0) {
        const rank = new Map(
          websitePackages
            .filter((p) => p.programme === programme)
            .map((p) => [p.key, (p.featured ? 0 : 1) * 1000 + (p.sort_order ?? 0)]),
        )
        const primary = [...price.choices].sort(
          (a, b) => (rank.get(a.key) ?? 9999) - (rank.get(b.key) ?? 9999),
        )[0]
        if (primary) return primary.amount
      }

      // No programme, or nothing published at all. The old behaviour, and
      // never worse than it.
      return 0
    },
    [allAutomations, websitePackages, pricingSettings],
  )
}
