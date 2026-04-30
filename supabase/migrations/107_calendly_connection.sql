-- Migration: real Calendly connection.
--
-- The existing schema only stored profiles.calendly_url (the user's public
-- scheduling link). For the webhook to actually work end-to-end we also
-- need:
--   - calendly_access_token  → so the app can call Calendly's API later
--                              (e.g. delete a webhook subscription on
--                              disconnect, fetch event details).
--   - calendly_user_uri      → the recruiter's URI so the webhook can
--                              link incoming events back to the right
--                              recruiter (the webhook already references
--                              this column; it just didn't exist).
--   - calendly_webhook_uri   → URI of the webhook subscription we create
--                              when the user connects, so we can DELETE
--                              it on disconnect instead of leaving an
--                              orphan subscription pinging us forever.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS calendly_access_token TEXT,
  ADD COLUMN IF NOT EXISTS calendly_user_uri TEXT,
  ADD COLUMN IF NOT EXISTS calendly_webhook_uri TEXT;

-- The webhook joins by calendly_user_uri; index it for the lookup hot path.
CREATE INDEX IF NOT EXISTS profiles_calendly_user_uri_idx
  ON profiles (calendly_user_uri);
