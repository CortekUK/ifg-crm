-- Fix: Re-apply the trigger function to properly handle re-enrollment
-- The previous migration may not have replaced the function correctly

DROP FUNCTION IF EXISTS handle_deal_stage_change() CASCADE;

CREATE OR REPLACE FUNCTION handle_deal_stage_change()
RETURNS TRIGGER AS $$
DECLARE
  automation RECORD;
  first_step RECORD;
  existing_enrollment RECORD;
  stop_stage_ids UUID[];
  next_step_time TIMESTAMPTZ;
BEGIN
  -- Only fire when current_stage_id is set (INSERT) or actually changes (UPDATE)
  IF NEW.current_stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- For UPDATE, skip if stage hasn't changed
  IF TG_OP = 'UPDATE' AND NEW.current_stage_id = OLD.current_stage_id THEN
    RETURN NEW;
  END IF;

  -- ============================================
  -- PART 1: AUTO-ENROLL - Check for automations to trigger
  -- ============================================
  FOR automation IN
    SELECT a.id, a.name, a.config, a.stop_on_stage_ids
    FROM automations a
    WHERE a.trigger_stage_id = NEW.current_stage_id
      AND a.pipeline_id = NEW.pipeline_id
      AND a.is_active = true
      AND (a.trigger_type IS NULL OR a.trigger_type IN ('enters_stage', 'deal_enters_stage', 'stage_change'))
  LOOP
    -- Get the first step of this automation
    SELECT * INTO first_step
    FROM automation_steps
    WHERE automation_id = automation.id
    ORDER BY step_order ASC
    LIMIT 1;

    -- Only proceed if automation has at least one step
    IF first_step IS NULL THEN
      CONTINUE;
    END IF;

    -- Check for existing enrollment (any status)
    SELECT * INTO existing_enrollment
    FROM automation_enrollments ae
    WHERE ae.automation_id = automation.id
      AND ae.deal_id = NEW.id;

    -- Calculate next_step_at based on first step's delay
    IF first_step.step_type = 'wait' THEN
      next_step_time := NOW() +
        ((COALESCE(first_step.delay_days, 0) * INTERVAL '1 day') +
         (COALESCE(first_step.delay_hours, 0) * INTERVAL '1 hour'));
    ELSE
      next_step_time := NOW();
    END IF;

    IF existing_enrollment IS NOT NULL THEN
      -- Enrollment exists - check status
      IF existing_enrollment.status IN ('active', 'paused') THEN
        -- Already active/paused, just skip - don't re-enroll
        RAISE NOTICE 'Deal % already enrolled in automation % with status %, skipping',
          NEW.id, automation.name, existing_enrollment.status;
        CONTINUE;
      END IF;

      -- Status is stopped or completed - reset and re-enroll
      UPDATE automation_enrollments SET
        status = 'active',
        current_step_id = first_step.id,
        next_step_at = next_step_time,
        enrolled_at = NOW(),
        completed_at = NULL,
        stopped_reason = NULL
      WHERE id = existing_enrollment.id;

      RAISE NOTICE 'Re-enrolled deal % in automation % (reset from % status)',
        NEW.id, automation.name, existing_enrollment.status;
    ELSE
      -- No existing enrollment, create new one
      INSERT INTO automation_enrollments (
        automation_id,
        deal_id,
        status,
        current_step_id,
        next_step_at,
        enrolled_at
      ) VALUES (
        automation.id,
        NEW.id,
        'active',
        first_step.id,
        next_step_time,
        NOW()
      );

      RAISE NOTICE 'Auto-enrolled deal % in automation % (triggered by stage change to %)',
        NEW.id, automation.name, NEW.current_stage_id;
    END IF;
  END LOOP;

  -- ============================================
  -- PART 2: EXIT CONDITIONS - Stop enrollments when deal moves to exit stage
  -- ============================================
  FOR existing_enrollment IN
    SELECT ae.id, ae.automation_id, a.stop_on_stage_ids, a.name
    FROM automation_enrollments ae
    JOIN automations a ON ae.automation_id = a.id
    WHERE ae.deal_id = NEW.id
      AND ae.status = 'active'
  LOOP
    stop_stage_ids := existing_enrollment.stop_on_stage_ids;

    IF stop_stage_ids IS NOT NULL AND NEW.current_stage_id = ANY(stop_stage_ids) THEN
      UPDATE automation_enrollments SET
        status = 'stopped',
        stopped_reason = 'Deal moved to exit stage',
        next_step_at = NULL
      WHERE id = existing_enrollment.id;

      INSERT INTO automation_logs (
        enrollment_id,
        step_id,
        deal_id,
        status,
        sent_at,
        log_type,
        error_message
      ) VALUES (
        existing_enrollment.id,
        (SELECT current_step_id FROM automation_enrollments WHERE id = existing_enrollment.id),
        NEW.id,
        'skipped',
        NOW(),
        'enrollment_stopped',
        'Deal moved to exit stage'
      );

      RAISE NOTICE 'Stopped enrollment % - deal % moved to exit stage %',
        existing_enrollment.id, NEW.id, NEW.current_stage_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_deal_stage_change ON deals;

CREATE TRIGGER on_deal_stage_change
  AFTER INSERT OR UPDATE OF current_stage_id ON deals
  FOR EACH ROW
  EXECUTE FUNCTION handle_deal_stage_change();

COMMENT ON FUNCTION handle_deal_stage_change() IS
'Trigger function that handles automation enrollment:
- Auto-enrolls deals when they enter a trigger stage
- Re-enrolls deals that were previously stopped/completed (for testing/demos)
- Skips deals that are already actively enrolled
- Stops enrollments when deals move to exit stages';
