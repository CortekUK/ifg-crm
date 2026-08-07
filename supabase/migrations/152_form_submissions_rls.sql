-- Lock down form_submissions.
--
-- The single policy was `FOR ALL USING (true)` to authenticated, so ANY logged-in
-- user — including a portal player (external recruit/parent) — could read, edit
-- and DELETE every raw lead submission (name/email/phone/DOB payloads). Raw lead
-- PII must never be reachable by players, and non-admins should not be able to
-- mutate/delete the audit trail.
--
-- New model: staff (admin/recruiter) can READ; only admins can write/delete.
-- Form ingest runs with the service role (bypasses RLS), so submissions keep
-- landing normally.

DROP POLICY IF EXISTS "Allow authenticated access to form_submissions" ON public.form_submissions;

CREATE POLICY form_submissions_select ON public.form_submissions
  FOR SELECT TO authenticated
  USING (get_user_role() <> 'player');

CREATE POLICY form_submissions_admin_write ON public.form_submissions
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
