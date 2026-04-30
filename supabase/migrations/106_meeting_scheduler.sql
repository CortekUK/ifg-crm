-- Migration: meeting_scheduler automation type.
--
-- Replaces the (now deprecated) interview_reminder shape with a flow that
-- mirrors how the team actually books interviews:
--   1. Trigger fires (e.g. deal enters Interview stage) → immediately send a
--      "schedule your meeting" email containing a booking link.
--   2. Player books, which sets deals.interview_date to the chosen
--      date+time.
--   3. Up to 2 optional reminders fire at user-configurable offsets BEFORE
--      that date (e.g. "1 day before", "1 hour before").
--
-- The "before-date" timing is implemented as a new step_type
-- (`wait_until_before_date`) that resolves next_step_at from the deal's
-- field at scheduling time instead of from a fixed delay since trigger.
-- The conditions JSONB on that step holds {field: 'interview_date'}.
--
-- deals.interview_date is widened from DATE to TIMESTAMPTZ so reminders can
-- be scheduled to the hour. Existing date values become 00:00 UTC on that
-- day, which is acceptable — no production usage currently relies on the
-- time component (the column has only ever been a date).

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Widen interview_date so hour-precision timing is meaningful.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE deals
  ALTER COLUMN interview_date TYPE TIMESTAMPTZ
  USING interview_date::timestamptz;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Extend automation_type check to include meeting_scheduler.
--    interview_reminder is left in for now so any in-flight automations
--    of that type don't fail their FK; the seeding below removes the
--    test data so nothing depends on it in this DB. The constant in the
--    Next.js + Edge Function code is also being removed.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE automations
  DROP CONSTRAINT IF EXISTS automations_automation_type_check;

ALTER TABLE automations
  ADD CONSTRAINT automations_automation_type_check
  CHECK (automation_type IN (
    'deal_creation',
    'initial_contact',
    'follow_up',
    'application_received',
    'interview_reminder',
    'meeting_scheduler',
    'post_interview',
    'deposit_invoice',
    'payment_overdue',
    'welcome_sequence',
    'pre_departure',
    'list_assignment',
    'custom'
  ));

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Extend automation_steps.step_type check to include
--    wait_until_before_date.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE automation_steps
  DROP CONSTRAINT IF EXISTS automation_steps_step_type_check;

ALTER TABLE automation_steps
  ADD CONSTRAINT automation_steps_step_type_check
  CHECK (step_type IN (
    'send_email',
    'wait',
    'wait_until_before_date',
    'send_sms',
    'move_to_stage',
    'create_deal',
    'notify',
    'create_portal_account'
  ));

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Delete existing interview_reminder automations (test data per user).
--    Cascade through automation_enrollments and automation_steps via FK.
-- ─────────────────────────────────────────────────────────────────────────
DELETE FROM automations WHERE automation_type = 'interview_reminder';
