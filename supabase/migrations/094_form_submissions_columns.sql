-- Migration: ensure form_submissions has the columns the webhook handlers
-- expect. Migration 007 declared `form_source` in the CREATE TABLE, but at
-- least one production database is missing it (drift), causing every inbound
-- form payload to fail its log insert silently — which is why the table is
-- empty even though contacts have been created from forms.
--
-- Idempotent: column adds use IF NOT EXISTS so re-running is safe.

ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS form_source TEXT;

-- Add index — same one migration 007 declared but only as part of the
-- table create, which never ran on the drifted DB.
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_source
  ON form_submissions(form_source);
