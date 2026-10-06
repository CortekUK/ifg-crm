-- Complete the INITIAL CONTACT MAP stop lists on UK GAP 2027 and
-- UNIVERSITY 2027 so a player who has paid, or already arrived, stops being
-- asked whether they are interested.
--
-- NOT YET APPLIED — this edits live automation config, so it needs sign-off:
--   node scripts/apply-migration.mjs supabase/migrations/188_initial_contact_stop_on_paid.sql
--
-- Summer Residency already stops on every stage from Contact Response to
-- Arrival (and migration 184 closed the last gaps there). The other two maps
-- stop only partway along, so the later stages were never covered:
--
--   UK GAP        stops at Send Invoice     — missing Deposit Paid, Arrival
--   UNIVERSITY    stops at Application      — missing Interview, Conditional
--                                             Offer, Send Invoice,
--                                             Deposit Paid, Arrival
--
-- A UK Gap player sitting on Deposit Paid was found still active in the
-- initial-contact sequence. The pipelines board stops every active sequence
-- itself, so this only bites on moves made any other way — which is exactly
-- what the Stripe webhook does when a payment lands.
--
-- The webhook now ends a deal's sequences on payment regardless of stop list,
-- so this migration is defence in depth for the remaining non-UI movers
-- (Calendly, the automation outcome steps, the invoice-sent mover).
--
-- Same shape as 184. Idempotent: stages already listed are not added twice,
-- and stage names absent from a pipeline are simply skipped.
UPDATE automations a
SET stop_on_stage_ids = (
  SELECT array_agg(DISTINCT x)
  FROM unnest(
    COALESCE(a.stop_on_stage_ids, '{}'::uuid[]) ||
    ARRAY(
      SELECT ps.id FROM pipeline_stages ps
      WHERE ps.pipeline_id = a.pipeline_id
        AND ps.name IN (
          'Contact Response', 'Zoom Scheduled', 'Follow Up',
          'Document Collecting', 'Reg Form received', 'Reg Form Received',
          'Application', 'Interview', 'Conditional Offer',
          'Send Invoice', 'Deposit Paid', 'Arrival'
        )
    )
  ) AS x
)
WHERE a.name IN (
  'UK Gap - INITIAL CONTACT MAP',
  'UNIVERSITY OF LANCASHIRE - INITIAL CONTACT MAP '
);
