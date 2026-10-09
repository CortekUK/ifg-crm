-- QA-22 Issue 1, applied to the automation that already exists.
--
-- The compiler now puts a "wait until the meeting is over" step in front of
-- the Post-Interview email (lib/automations/compile.ts → postInterviewSequence),
-- but compiling only happens when an automation is SAVED. The steps of an
-- automation built before that change are already in the database, so
-- "QA Post Interview" would still send the thank-you the instant a card landed
-- on Interview — QA would retest and see the 7 Oct behaviour unchanged.
--
-- This inserts the missing first step for any post_interview automation that
-- does not already have one, and shifts the existing steps up to make room.
--
-- wait_until_meeting_ends resolves to the booked Calendly meeting's end time,
-- or the end of the day on the deal's interview date when there is no booking,
-- or "now" when there is neither — so a deal with no interview date still gets
-- its email rather than parking forever.
--
-- Idempotent: an automation that already starts with the wait is skipped.

DO $$
DECLARE
  a RECORD;
BEGIN
  FOR a IN
    SELECT au.id, au.name
    FROM automations au
    WHERE au.automation_type = 'post_interview'
      AND NOT EXISTS (
        SELECT 1 FROM automation_steps s
        WHERE s.automation_id = au.id
          AND s.step_type = 'wait_until_meeting_ends'
      )
  LOOP
    -- Shift downwards first, highest order first, so the unique
    -- (automation_id, step_order) pairing is never violated mid-update.
    UPDATE automation_steps
    SET step_order = step_order + 1
    WHERE automation_id = a.id;

    INSERT INTO automation_steps (
      automation_id, step_order, step_type,
      delay_days, delay_hours,
      email_template_id, sms_content, target_stage_id, conditions
    ) VALUES (
      a.id, 1, 'wait_until_meeting_ends',
      0, 0,
      NULL, NULL, NULL, NULL
    );

    RAISE NOTICE 'Post-Interview automation % now waits for the interview to end', a.name;
  END LOOP;
END $$;
