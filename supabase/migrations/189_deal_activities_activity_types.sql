-- Let the deal timeline record the five things it was already being told about
-- and silently rejecting.
--
-- NOT YET APPLIED — needs sign-off:
--   node scripts/apply-migration.mjs supabase/migrations/189_deal_activities_activity_types.sql
--
-- Five activity types are written by code and absent from this constraint, so
-- every one of those inserts was rejected. None of the call sites looked at the
-- result, so all five failed invisibly:
--
--   deal_won, deal_lost   /api/deals/[id]/close        — closing a deal left
--                                                        no trace at all
--   invoice_created       process-automations          — an invoice raised by
--                                                        an automation was
--                                                        never shown on the deal
--   meeting_scheduled,    calendly-webhook             — a player booking or
--   meeting_cancelled                                    cancelling a Zoom was
--                                                        never shown on the deal
--
-- Verified against the live database by closing a deal won, then lost with a
-- reason, then won again: four correct `deals` rows, zero deal_activities rows.
--
-- Additive only — the five new values widen what is allowed and every existing
-- row already satisfies the constraint, so there is no rewrite and nothing to
-- back out. The timeline renders an activity_type generically (underscores →
-- spaces, capitalised), so these read as "Deal won", "Invoice created",
-- "Meeting scheduled" with no UI change needed.
ALTER TABLE deal_activities
  DROP CONSTRAINT IF EXISTS deal_activities_activity_type_check;

ALTER TABLE deal_activities
  ADD CONSTRAINT deal_activities_activity_type_check CHECK (
    activity_type = ANY (ARRAY[
      'stage_changed', 'note_added', 'email_sent', 'email_opened',
      'sms_sent', 'sms_received', 'call_scheduled', 'call_completed',
      'document_uploaded', 'invoice_sent', 'payment_received',
      'deal_created', 'owner_changed',
      -- new: written by code all along, rejected until now
      'deal_won', 'deal_lost', 'invoice_created',
      'meeting_scheduled', 'meeting_cancelled'
    ]::text[])
  );
