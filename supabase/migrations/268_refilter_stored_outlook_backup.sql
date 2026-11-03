-- The undo record for scripts/refilter-stored-outlook.mjs.
--
-- That script runs the Outlook relevance filter over mail stored before the
-- filter existed, which 267 could only partly do from SQL. Rows are hidden as
-- 'personal', never deleted, and what each one was is kept here.
-- Undo: supabase/rollbacks/268_down.sql

CREATE TABLE IF NOT EXISTS reclassified_personal_268 (
  id             bigserial PRIMARY KEY,
  changed_at     timestamptz NOT NULL DEFAULT now(),
  source_table   text NOT NULL CHECK (source_table IN ('email_threads', 'email_replies')),
  row_id         uuid NOT NULL,
  previous_value text
);

-- Same exposure 266 closed on the other backup tables: no policy, no API reach.
ALTER TABLE reclassified_personal_268 ENABLE ROW LEVEL SECURITY;
