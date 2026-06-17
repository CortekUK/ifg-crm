-- Migration 136: relocate Calendly secrets off `profiles`.
--
-- profiles has a permissive "authenticated can read all rows" SELECT policy so
-- the team can see each other's name / owner / booking link. That also exposed
-- calendly_access_token (a Calendly Personal Access Token) and the webhook
-- secret to every logged-in user. Move the secrets into a per-user table with
-- owner-only RLS. The public booking link (profiles.calendly_url) stays put —
-- it's used by the {{deal_owner_calendly}} merge tag and is not sensitive.

CREATE TABLE IF NOT EXISTS calendly_credentials (
  user_id        UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  access_token   TEXT,
  webhook_secret TEXT,
  webhook_uri    TEXT,
  user_uri       TEXT,
  connected_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The webhook looks recruiters up by their Calendly user URI.
CREATE INDEX IF NOT EXISTS idx_calendly_credentials_user_uri
  ON calendly_credentials(user_uri);

ALTER TABLE calendly_credentials ENABLE ROW LEVEL SECURITY;

-- Owner-only access. The service role (webhook + server routes) bypasses RLS.
DROP POLICY IF EXISTS calendly_credentials_owner_all ON calendly_credentials;
CREATE POLICY calendly_credentials_owner_all ON calendly_credentials
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Backfill from the soon-to-be-dropped profiles columns. (This deployment's
-- profiles only ever had access_token / webhook_uri / user_uri — there was no
-- per-user webhook_secret column; webhook signing uses a global env var.)
INSERT INTO calendly_credentials (user_id, access_token, webhook_uri, user_uri)
SELECT id, calendly_access_token, calendly_webhook_uri, calendly_user_uri
  FROM profiles
 WHERE calendly_access_token IS NOT NULL
    OR calendly_webhook_uri  IS NOT NULL
    OR calendly_user_uri     IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Drop the relocated columns. Keep profiles.calendly_url (public booking link).
ALTER TABLE profiles DROP COLUMN IF EXISTS calendly_access_token;
ALTER TABLE profiles DROP COLUMN IF EXISTS calendly_webhook_secret;
ALTER TABLE profiles DROP COLUMN IF EXISTS calendly_webhook_uri;
ALTER TABLE profiles DROP COLUMN IF EXISTS calendly_user_uri;
