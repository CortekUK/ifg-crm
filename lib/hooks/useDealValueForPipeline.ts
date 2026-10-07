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
 * Falls back to 0 when the programme cannot be resolved, which is the old
 * behaviour and never worse than it.
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
      return price.amount ?? 0
    },
    [allAutomations, websitePackages, pricingSettings],
  )
}
