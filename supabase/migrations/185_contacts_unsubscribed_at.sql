-- Records WHEN a contact opted out of email, which nothing did before.
--
-- Three columns already answered "is this person unsubscribed" and disagreed
-- with each other:
--   subscription_status  — the only one the automation engine gates sends on
--   email_subscribed     — the per-channel flag from migration 035
--   email_unsubscribed / email_unsubscribed_at
--        — written by app/api/webhooks/resend on a spam complaint, and NEVER
--          CREATED BY ANY MIGRATION. That update has been failing silently
--          since it was written, which is why a spam complaint never actually
--          stopped the emails. Rather than add a third source of truth, the
--          route now writes the two columns that exist (see that file); these
--          two phantom columns are deliberately NOT created here.
--
-- This adds only the timestamp, which is a fact none of the others carried and
-- which an opt-out needs for compliance: proof of when consent was withdrawn.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;

COMMENT ON COLUMN public.contacts.unsubscribed_at IS
  'When the contact opted out of email. Set alongside subscription_status = ''unsubscribed'' and email_subscribed = false. Null for contacts who never opted out.';

-- Backfill: anyone already unsubscribed has no recorded date, and inventing
-- one would be worse than leaving it null. Only the column is added.
