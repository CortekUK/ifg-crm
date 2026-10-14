-- Migration 251: URGENT — the Replies screen went blank in production.
--
-- WHAT BROKE
-- Migration 245 added email_replies.mailbox_user_id REFERENCES profiles(id).
-- email_replies already had matched_by_id REFERENCES profiles(id), so the
-- table suddenly had TWO foreign keys to profiles.
--
-- The Replies list embeds the matcher as `matched_by:profiles(*)` — no key
-- named. With one relationship that is unambiguous; with two, PostgREST
-- refuses the whole request:
--
--   PGRST201  Could not embed because more than one relationship was found
--             for 'email_replies' and 'profiles'
--
-- So every reply query failed and the screen showed its empty state. The tab
-- counts kept working, because they come from a database function that embeds
-- nothing — which is why it looked like "no replies" rather than an error.
--
-- WHY IT REACHED PRODUCTION
-- The migration was applied to the live database while the deployed app still
-- ran the old query. A schema change that is harmless with the new code is not
-- harmless with the old, and the deploy had not happened. That ordering is the
-- actual mistake, not the column.
--
-- THE FIX, AND WHY THIS ONE
-- Dropping the constraint restores a single profiles relationship, so the
-- DEPLOYED query resolves again immediately — no deploy required, which is
-- what matters while the client cannot see their replies. The fixed client
-- code names the key explicitly (profiles!email_replies_matched_by_id_fkey)
-- and keeps working either way, so this is safe in both directions.
--
-- The COLUMN stays. Nothing depends on the constraint: the RLS policies in 248
-- read mailbox_user_id directly, the Outlook ingest writes it directly, and the
-- 245 backfill has already run. Only referential integrity is given up — a
-- deleted profile will leave a stale id instead of nulling it.
--
-- RESTORE IT once the application code is deployed:
--   ALTER TABLE email_replies
--     ADD CONSTRAINT email_replies_mailbox_user_id_fkey
--     FOREIGN KEY (mailbox_user_id) REFERENCES profiles(id) ON DELETE SET NULL;
-- and keep the explicit-key embed in lib/hooks/useEmailReplies.ts.

ALTER TABLE email_replies DROP CONSTRAINT IF EXISTS email_replies_mailbox_user_id_fkey;

COMMENT ON COLUMN email_replies.mailbox_user_id IS
  'CRM user whose connected Outlook received this. NULL = arrived via the bulk sender (Resend). The foreign key to profiles was dropped in migration 251: a second relationship to profiles made PostgREST refuse the Replies embed. Restore it once the app is deployed with the explicit-key embed.';
