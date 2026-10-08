/**
 * What has to happen on a deal when its invoice gets paid.
 *
 * This lived inline in the Stripe webhook, so it only ever ran for card
 * payments. A player who paid by bank transfer had their invoice marked paid
 * and nothing else: their card stayed in Initial Lead and the "are you
 * interested?" sequence kept chasing them for money they had already sent.
 *
 * Both payment routes now call this, so the two cannot drift apart again.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type PaymentAppliedResult = {
  dealId: string | null
  /** Enrollment ids ended because the money arrived. */
  stoppedEnrollments: string[]
  /** The stage the deal was moved to, or null if it did not move. */
  movedToStageId: string | null
  /** Why it did not move, for logs. */
  skipped?: 'no-deal' | 'no-deposit-paid-stage' | 'already-at-or-past'
}

/**
 * Stop the chasing and move the deal to Deposit Paid.
 *
 * Order matters. Sequences are stopped BEFORE the stage move so that the
 * welcome sequence Deposit Paid triggers survives, and an automation
 * triggered BY that stage is excluded so a second payment on a deal already
 * sitting there doesn't kill its own welcome emails.
 *
 * Only ever moves forward: a deal already past Deposit Paid (Arrival, say) is
 * left where it is.
 *
 * `supabase` must be a service-role client — this stops automations and moves
 * a card, neither of which a browser session should be doing on its own.
 */
export async function applyPaymentToDeal(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<PaymentAppliedResult> {
  const { data: invoice } = await supabase
    .from('invoices')
    .select('deal_id')
    .eq('id', invoiceId)
    .single()

  if (!invoice?.deal_id) {
    return { dealId: null, stoppedEnrollments: [], movedToStageId: null, skipped: 'no-deal' }
  }

  const { data: deal } = await supabase
    .from('deals')
    .select('id, pipeline_id, current_stage_id')
    .eq('id', invoice.deal_id)
    .single()

  if (!deal) {
    return { dealId: null, stoppedEnrollments: [], movedToStageId: null, skipped: 'no-deal' }
  }

  const { data: depositPaidStage } = await supabase
    .from('pipeline_stages')
    .select('id, display_order')
    .eq('pipeline_id', deal.pipeline_id)
    .ilike('name', '%deposit%paid%')
    .maybeSingle()

  // ---- STOP CHASING SOMEONE WHO HAS JUST PAID ----
  //
  // This deliberately does not rely on the handle_deal_stage_change trigger,
  // which only stops an enrollment when the destination is in that
  // automation's stop_on_stage_ids — and "Deposit Paid" is absent from the
  // INITIAL CONTACT MAP stop list on both UNIVERSITY 2027 and UK GAP 2027.
  // Fixing those lists by hand would leave the next automation someone builds
  // with the same hole, so payment itself ends the chasing.
  const { data: liveEnrollments } = await supabase
    .from('automation_enrollments')
    .select('id, automation:automations!inner(trigger_stage_id)')
    .eq('deal_id', deal.id)
    .eq('status', 'active')

  // PostgREST types a to-one embed as an array; normalise either shape.
  const triggerStageOf = (row: { automation?: unknown }): string | null => {
    const a = row.automation
    const one = Array.isArray(a) ? a[0] : a
    return (one as { trigger_stage_id?: string | null } | null)?.trigger_stage_id ?? null
  }

  const toStop = (liveEnrollments ?? [])
    .filter((e) => !depositPaidStage || triggerStageOf(e) !== depositPaidStage.id)
    .map((e) => e.id as string)

  if (toStop.length) {
    await supabase
      .from('automation_enrollments')
      .update({
        status: 'stopped',
        stopped_reason: 'Payment received',
        next_step_at: null,
      })
      .in('id', toStop)
    console.log(`Stopped ${toStop.length} active sequence(s) on deal ${deal.id} — payment received`)
  }

  if (!depositPaidStage) {
    return {
      dealId: deal.id,
      stoppedEnrollments: toStop,
      movedToStageId: null,
      skipped: 'no-deposit-paid-stage',
    }
  }

  let currentOrder = -1
  if (deal.current_stage_id) {
    const { data: currentStage } = await supabase
      .from('pipeline_stages')
      .select('display_order')
      .eq('id', deal.current_stage_id)
      .single()
    currentOrder = currentStage?.display_order ?? -1
  }

  if (currentOrder >= (depositPaidStage.display_order ?? 0)) {
    console.log(`Deal ${deal.id} already at/after Deposit Paid — not moving back`)
    return {
      dealId: deal.id,
      stoppedEnrollments: toStop,
      movedToStageId: null,
      skipped: 'already-at-or-past',
    }
  }

  await supabase
    .from('deals')
    .update({ current_stage_id: depositPaidStage.id })
    .eq('id', deal.id)
  console.log(`Deal ${deal.id} moved to Deposit Paid stage`)

  return { dealId: deal.id, stoppedEnrollments: toStop, movedToStageId: depositPaidStage.id }
}
