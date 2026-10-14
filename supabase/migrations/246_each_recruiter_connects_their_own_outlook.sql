-- Migration 246: per-user Outlook (Microsoft Graph) connection.
--
-- Modelled exactly on calendly_credentials (migration 136), and for the same
-- reason: `profiles` carries a permissive "authenticated can read all rows"
-- SELECT policy so the team can see each other's name and booking link. That
-- is precisely how the Calendly access token ended up readable by every
-- logged-in user. A Microsoft REFRESH TOKEN is far worse — it grants ongoing
-- Mail.Send and Mail.ReadWrite on a real human's mailbox.
--
-- So: never on profiles. Own table, owner-only RLS, service role bypasses it
-- for the webhook and the sync cron.

CREATE TABLE IF NOT EXISTS outlook_credentials (
  user_id                  UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

  -- Tokens. access_token lasts ~1 hour; refresh_token is the valuable one and
  -- is what actually needs protecting. Never logged, never sent to a browser.
  access_token             TEXT,
  refresh_token            TEXT,
  -- When access_token dies. We refresh BEFORE every call based on this rather
  -- than waiting for a 401, per the spec's first "things that will bite".
  token_expires_at         TIMESTAMPTZ,

  -- Which mailbox was actually connected. Not assumed to equal profiles.email:
  -- a recruiter may sign in with a different Microsoft account than the address
  -- the CRM holds, and the ingest matches on the real mailbox.
  mailbox_email            TEXT,
  mailbox_display_name     TEXT,
  -- Graph's immutable id for the signed-in user, for notification lookups.
  graph_user_id            TEXT,

  -- 'connected'        — working
  -- 'reconnect_needed' — refresh token rejected (usually a password change).
  --                      A normal state with its own UI, NOT an error. The
  --                      spec is explicit: connections do break.
  -- 'disconnected'     — user disconnected; row kept so history survives
  status                   TEXT NOT NULL DEFAULT 'connected'
    CHECK (status IN ('connected', 'reconnect_needed', 'disconnected')),
  status_detail            TEXT,

  -- Change-notification subscriptions, one per watched folder. Graph expires
  -- these in about three days; the renewal cron reads expires_at to know what
  -- to rebuild. If nobody renews, mail stops arriving and NOTHING errors —
  -- which is why the expiry is stored rather than inferred.
  inbox_subscription_id    TEXT,
  inbox_subscription_expires_at  TIMESTAMPTZ,
  sent_subscription_id     TEXT,
  sent_subscription_expires_at   TIMESTAMPTZ,

  -- Delta cursors for the catch-up sweep. Notifications DO get missed; the
  -- sweep asks Graph "what changed since this token" and fills the gaps.
  inbox_delta_link         TEXT,
  sent_delta_link          TEXT,
  last_synced_at           TIMESTAMPTZ,
  last_sync_error          TEXT,

  connected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The webhook arrives knowing only a subscription id, and must find the
-- mailbox it belongs to before it can do anything.
CREATE INDEX IF NOT EXISTS idx_outlook_credentials_inbox_sub
  ON outlook_credentials(inbox_subscription_id);
CREATE INDEX IF NOT EXISTS idx_outlook_credentials_sent_sub
  ON outlook_credentials(sent_subscription_id);
-- The ingest resolves "which CRM user owns this mailbox" by address.
CREATE INDEX IF NOT EXISTS idx_outlook_credentials_mailbox_email
  ON outlook_credentials(LOWER(mailbox_email));

ALTER TABLE outlook_credentials ENABLE ROW LEVEL SECURITY;

-- Owner-only, for every operation. Note there is deliberately NO admin read
-- policy: an admin has no business reading another person's refresh token, and
-- the connection status an admin might legitimately want is surfaced through
-- the service-role API route instead.
DROP POLICY IF EXISTS outlook_credentials_owner_all ON outlook_credentials;
CREATE POLICY outlook_credentials_owner_all ON outlook_credentials
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE outlook_credentials IS
  'Per-user Microsoft Graph connection. Owner-only RLS: refresh tokens grant ongoing mailbox access, so they must never sit on the world-readable profiles table (see migration 136).';
COMMENT ON COLUMN outlook_credentials.status IS
  'connected | reconnect_needed | disconnected. reconnect_needed is a normal state with its own UI, not an error.';
COMMENT ON COLUMN outlook_credentials.inbox_subscription_expires_at IS
  'Graph expires mail subscriptions in ~3 days. The renewal cron reads this. If renewal stops, mail stops arriving silently.';

-- Keep updated_at honest without every caller remembering to set it.
CREATE OR REPLACE FUNCTION touch_outlook_credentials()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_outlook_credentials ON outlook_credentials;
CREATE TRIGGER trg_touch_outlook_credentials
  BEFORE UPDATE ON outlook_credentials
  FOR EACH ROW EXECUTE FUNCTION touch_outlook_credentials();
