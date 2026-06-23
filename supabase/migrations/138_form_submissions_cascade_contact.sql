-- Migration 138: Cascade form_submissions when their contact is deleted.
--
-- form_submissions.contact_id was created ON DELETE SET NULL (migration 007),
-- so deleting a contact left an orphan submission row behind — still visible
-- in the Form Submissions admin view with a blank submitter. The operator
-- expects deleting a contact to remove its submissions too. Switch the FK to
-- ON DELETE CASCADE.
--
-- Idempotent: drops the existing constraint (whatever its current action) and
-- recreates it with CASCADE. The constraint name follows the default Postgres
-- naming (<table>_<column>_fkey); we look it up dynamically in case it differs.

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att
    ON att.attrelid = con.conrelid
   AND att.attnum = ANY (con.conkey)
  WHERE rel.relname = 'form_submissions'
    AND att.attname = 'contact_id'
    AND con.contype = 'f';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE form_submissions DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  ALTER TABLE form_submissions
    ADD CONSTRAINT form_submissions_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
END $$;
