-- The invite UI showed user_invites.expires_at (created_at + 7 days), but the
-- link itself was governed by Supabase auth's mailer_otp_exp, which was 3600 —
-- one hour. So the CRM said an invite was good for a week while the link had
-- been dead since teatime, which is why invites "didn't work".
--
-- mailer_otp_exp is now 604800 (7 days) to match, set via the Management API.
-- This records that the two are deliberately aligned, so a future change to one
-- is a prompt to change the other.

COMMENT ON COLUMN public.user_invites.expires_at IS
  'When the invitation lapses. Must stay in step with Supabase auth mailer_otp_exp (currently 604800s / 7 days), which is what actually expires the emailed link.';
