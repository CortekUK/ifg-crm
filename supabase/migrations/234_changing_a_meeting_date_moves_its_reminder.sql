-- QA-21 Bug 5: changing the meeting date did not move the reminder.
--
-- A Meeting Scheduler reminder is realised as next_step_at on the enrolment,
-- computed once when the enrolment arrives at the wait step:
--
--     next_step_at = deals.<field> - (delay_days || delay_hours)
--
-- Nothing recomputed it afterwards. QA moved a player's interview from 7 Oct
-- to 9 Oct and the reminder stayed scheduled for 21:00 UTC on 6 October — so
-- "3 hours before your meeting" would have gone out two days early, and
-- nothing would fire for the real meeting. Rescheduling an interview is
-- routine, which makes this the normal case rather than an edge one.
--
-- Doing it in a trigger covers every route that edits the date: the deal card,
-- an import, a Calendly booking writing the date back, or anything added
-- later. The alternative — recomputing in the step processor — only helps for
-- enrolments that have not reached the wait step yet, which is precisely not
-- the broken case.
--
-- Only ACTIVE enrolments sitting ON the wait step are touched. A step already
-- carried out is history, and a stopped or completed enrolment is finished.

CREATE OR REPLACE FUNCTION reschedule_date_waits_on_deal_date_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
  v_target TIMESTAMPTZ;
BEGIN
  FOR r IN
    SELECT ae.id AS enrollment_id,
           s.step_type,
           s.conditions->>'field' AS field,
           COALESCE(s.delay_days, 0)  AS delay_days,
           COALESCE(s.delay_hours, 0) AS delay_hours
    FROM automation_enrollments ae
    JOIN automation_steps s ON s.id = ae.current_step_id
    WHERE ae.deal_id = NEW.id
      AND ae.status = 'active'
      AND s.step_type IN ('wait_until_before_date', 'wait_until_meeting_ends')
  LOOP
    v_target := NULL;

    IF r.step_type = 'wait_until_before_date' THEN
      -- Only the field this step actually counts back from.
      IF r.field = 'interview_date' AND NEW.interview_date IS DISTINCT FROM OLD.interview_date THEN
        v_target := NEW.interview_date
                    - make_interval(days => r.delay_days, hours => r.delay_hours);
      ELSIF r.field = 'programme_start_date'
            AND NEW.programme_start_date IS DISTINCT FROM OLD.programme_start_date THEN
        v_target := NEW.programme_start_date::timestamptz
                    - make_interval(days => r.delay_days, hours => r.delay_hours);
      ELSIF r.field = 'arrival_date' AND NEW.arrival_date IS DISTINCT FROM OLD.arrival_date THEN
        v_target := NEW.arrival_date::timestamptz
                    - make_interval(days => r.delay_days, hours => r.delay_hours);
      END IF;

    ELSIF r.step_type = 'wait_until_meeting_ends'
          AND NEW.interview_date IS DISTINCT FROM OLD.interview_date THEN
      -- Mirrors calculateNextStepTime: a booked Calendly meeting wins, and the
      -- interview date is the fallback. Here the delay acts as a buffer AFTER
      -- the meeting rather than before it.
      SELECT ce.end_time INTO v_target
      FROM calendly_events ce
      WHERE ce.deal_id = NEW.id
      ORDER BY ce.start_time DESC
      LIMIT 1;

      IF v_target IS NULL AND NEW.interview_date IS NOT NULL THEN
        v_target := date_trunc('day', NEW.interview_date) + interval '23 hours 59 minutes 59 seconds';
      END IF;

      IF v_target IS NOT NULL THEN
        v_target := v_target + make_interval(days => r.delay_days, hours => r.delay_hours);
      END IF;
    END IF;

    IF v_target IS NOT NULL THEN
      UPDATE automation_enrollments
      SET next_step_at = v_target
      WHERE id = r.enrollment_id
        AND next_step_at IS DISTINCT FROM v_target;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION reschedule_date_waits_on_deal_date_change() IS
  'QA-21 Bug 5: moving a programme or interview date re-times any reminder '
  'waiting on it, instead of leaving it fixed to the old date.';

DROP TRIGGER IF EXISTS deal_date_change_reschedules_waits ON deals;
CREATE TRIGGER deal_date_change_reschedules_waits
AFTER UPDATE OF interview_date, programme_start_date, arrival_date ON deals
FOR EACH ROW
WHEN (
  NEW.interview_date       IS DISTINCT FROM OLD.interview_date
  OR NEW.programme_start_date IS DISTINCT FROM OLD.programme_start_date
  OR NEW.arrival_date      IS DISTINCT FROM OLD.arrival_date
)
EXECUTE FUNCTION reschedule_date_waits_on_deal_date_change();
