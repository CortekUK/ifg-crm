-- Migration 081: Prevent duplicate automation_logs with a partial unique index.
--
-- Problem today:
--   processEmailStep in supabase/functions/process-automations/index.ts uses
--   a SELECT-then-INSERT pattern to check whether an email has already been
--   sent for a given (enrollment, step). Two concurrent invocations of the
--   edge function can both SELECT-miss and both send, so the same email
--   goes out twice. Optimistic locking on automation_enrollments.next_step_at
--   is the primary defence, but it is best-effort; this index is the backstop.
--
-- Design:
--   * Add enrolled_at_snapshot — a copy of the enrollment's enrolled_at at
--     log creation time. Re-enrolments keep the same enrollment_id but get
--     a fresh enrolled_at, so different cycles have different snapshots and
--     therefore different unique-index tuples. That lets re-enrolments send
--     their emails without being blocked by logs from the previous cycle.
--
--   * Partial unique index scoped to (status IN ('sent', 'pending')) so that
--     'failed' and 'skipped' logs do not occupy the slot — retries can always
--     insert a fresh 'pending' row after a previous attempt failed.
--
--   * Index is also partial on enrolled_at_snapshot IS NOT NULL so historical
--     rows (which predate this column) never conflict with the new rows, and
--     index creation cannot fail on existing data.

ALTER TABLE automation_logs
  ADD COLUMN IF NOT EXISTS enrolled_at_snapshot timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS automation_logs_dedup_active
  ON automation_logs (enrollment_id, step_id, enrolled_at_snapshot)
  WHERE enrolled_at_snapshot IS NOT NULL
    AND status IN ('sent', 'pending');

COMMENT ON COLUMN automation_logs.enrolled_at_snapshot IS
  'Snapshot of automation_enrollments.enrolled_at at log creation time. Discriminates re-enrolment cycles for the dedup unique index (automation_logs_dedup_active).';
