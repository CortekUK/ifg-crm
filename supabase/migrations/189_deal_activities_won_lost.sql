-- Let the deal timeline record a deal being won or lost.
--
-- NOT YET APPLIED — needs sign-off:
--   node scripts/apply-migration.mjs supabase/migrations/189_deal_activities_won_lost.sql
--
-- /api/deals/[id]/close has always inserted a deal_activities row with
-- activity_type 'deal_won' or 'deal_lost'. Neither is in the column's CHECK
-- constraint, so every one of those inserts was rejected — and the route did
-- not look at the result, so it failed silently. Closing a deal left no trace
-- on the timeline at all.
--
-- Verified against the live database: marking a deal won, then lost with a
-- reason, then won again produced four correct `deals` rows and zero
-- deal_activities rows.
--
-- Additive only: the two new values widen what is allowed and every existing
-- row already satisfies the constraint, so there is no rewrite and nothing to
-- back out. The timeline renders an activity_type generically
-- (underscores → spaces, capitalised), so these show as "Deal won" / "Deal
-- lost" with no UI change needed.
ALTER TABLE deal_activities
  DROP CONSTRAINT IF EXISTS deal_activities_activity_type_check;

ALTER TABLE deal_activities
  ADD CONSTRAINT deal_activities_activity_type_check CHECK (
    activity_type = ANY (ARRAY[
      'stage_changed', 'note_added', 'email_sent', 'email_opened',
      'sms_sent', 'sms_received', 'call_scheduled', 'call_completed',
      'document_uploaded', 'invoice_sent', 'payment_received',
      'deal_created', 'owner_changed',
      -- new
      'deal_won', 'deal_lost'
    ]::text[])
  );
