-- Migration: wait_until_meeting_ends step type.
--
-- Final step appended automatically to every meeting_scheduler automation.
-- Resolves next_step_at from the deal's most recent scheduled
-- calendly_event.end_time (so the enrollment finishes naturally once the
-- meeting is over). Sequence semantics: a meeting_scheduler enrollment
-- completes only after schedule email + reminders + meeting end has passed.

ALTER TABLE automation_steps
  DROP CONSTRAINT IF EXISTS automation_steps_step_type_check;

ALTER TABLE automation_steps
  ADD CONSTRAINT automation_steps_step_type_check
  CHECK (step_type IN (
    'send_email',
    'wait',
    'wait_until_before_date',
    'wait_until_meeting_ends',
    'send_sms',
    'move_to_stage',
    'create_deal',
    'notify',
    'create_portal_account'
  ));
