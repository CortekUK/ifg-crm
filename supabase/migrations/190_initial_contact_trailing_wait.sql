-- Give the live Initial Contact automations the wait after email 3 that their
-- builder has always claimed to have.
--
-- NOT YET APPLIED — this edits the compiled steps of live automations with
-- players mid-sequence, so it needs sign-off:
--   node scripts/apply-migration.mjs supabase/migrations/190_initial_contact_trailing_wait.sql
--
-- The compiler now emits it (lib/automations/compile.ts, threeEmailSequence
-- trailingWait), but compiled steps are only rewritten when someone re-saves
-- the automation. The three live maps were compiled before the fix, so without
-- this they keep ending on email 3: the enrollment completes on the same cron
-- tick that sends it, and move_deal_on_enrollment_exit files the player as
-- Dormant seconds after asking whether they are still interested.
--
-- Shape before (Initial Contact with the Dormant reminder tail):
--   1 email  2 wait  3 email  4 wait  5 email  6 move→Dormant  7 reminder  8 wait
-- after:
--   1 email  2 wait  3 email  4 wait  5 email  6 WAIT  7 move→Dormant  8 reminder  9 wait
--
-- The wait length is the one already configured in config.wait_days[2],
-- falling back to the template default of 7 days.
--
-- Three things move together, and all three have to:
--   1. the inserted wait step
--   2. the step_order of everything after it (+1)
--   3. config.recurring_loop_to_order (+1) — the engine loops back to it by
--      ORDER, not by id, so leaving it behind would send the fortnightly
--      Dormant reminder from the wrong step.
--
-- In-flight enrollments are untouched: current_step_id is an id, not an order,
-- so a player already parked on the Dormant reminder stays there.
--
-- Idempotent: an automation whose 3rd email is already followed by a wait is
-- skipped, so re-running changes nothing.

DO $$
DECLARE
  a            RECORD;
  third_order  INT;
  next_type    TEXT;
  wait_len     INT;
  loop_order   INT;
BEGIN
  FOR a IN
    SELECT id, config
    FROM automations
    WHERE automation_type = 'initial_contact'
  LOOP
    -- step_order of the third send_email in this automation.
    SELECT step_order INTO third_order
    FROM (
      SELECT step_order, row_number() OVER (ORDER BY step_order) AS n
      FROM automation_steps
      WHERE automation_id = a.id AND step_type = 'send_email'
    ) e
    WHERE e.n = 3;

    IF third_order IS NULL THEN
      CONTINUE;  -- fewer than three emails; not the shape this fixes
    END IF;

    SELECT step_type INTO next_type
    FROM automation_steps
    WHERE automation_id = a.id AND step_order = third_order + 1;

    -- Already has its trailing wait (or was re-saved since the fix).
    IF next_type = 'wait' THEN
      CONTINUE;
    END IF;

    wait_len := COALESCE(NULLIF(a.config->'wait_days'->>2, '')::int, 7);

    -- Two-phase shift: UNIQUE(automation_id, step_order) rejects a single
    -- in-place +1 because the rows collide mid-statement.
    UPDATE automation_steps
    SET step_order = step_order + 1001
    WHERE automation_id = a.id AND step_order > third_order;

    UPDATE automation_steps
    SET step_order = step_order - 1000
    WHERE automation_id = a.id AND step_order > 1000;

    INSERT INTO automation_steps (
      automation_id, step_order, step_type, delay_days, delay_hours
    ) VALUES (
      a.id, third_order + 1, 'wait', wait_len, 0
    );

    -- Keep the recurring loop pointing at the Dormant reminder send.
    loop_order := NULLIF(a.config->>'recurring_loop_to_order', '')::int;
    IF loop_order IS NOT NULL AND loop_order > third_order THEN
      UPDATE automations
      SET config = config || jsonb_build_object('recurring_loop_to_order', loop_order + 1)
      WHERE id = a.id;
    END IF;
  END LOOP;
END $$;
