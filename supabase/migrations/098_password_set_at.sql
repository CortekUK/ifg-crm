-- Migration: bulletproof "user has saved a real password" signal.
--
-- Why we need this: Supabase's admin API does not expose auth.users.encrypted_password
-- (redacted for security), so we can't observe it from the app. The other
-- signals are unreliable:
--   - email_confirmed_at flips when the magic link is clicked, before any password
--   - last_sign_in_at also flips on magic-link sign-in
--   - identities[].provider='email' is created at invite time, also before any password
-- We control profiles.password_set_at ourselves: stamped to NOW() ONLY after
-- supabase.auth.updateUser({password}) returns success. No Supabase quirk can
-- spoof it.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;

-- Backfill: existing staff (admin / super_admin / recruiter) who already log
-- into the CRM definitely have working passwords — mark them as set so they
-- don't suddenly look pending. Players are left NULL because, per the live
-- data audit, none of them have actually saved a password yet.
UPDATE profiles
   SET password_set_at = COALESCE(password_set_at, NOW())
 WHERE role IN ('admin', 'super_admin', 'recruiter');

CREATE INDEX IF NOT EXISTS idx_profiles_password_set_at
  ON profiles(password_set_at) WHERE password_set_at IS NOT NULL;
