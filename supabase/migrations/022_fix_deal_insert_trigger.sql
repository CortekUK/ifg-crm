-- Fix: Add INSERT trigger for new deals
-- This allows automations to trigger when deals are created, not just when stage changes
-- Previously the trigger only fired on UPDATE, missing new deals entirely

CREATE OR REPLACE FUNCTION handle_deal_stage_change()
RETURNS TRIGGER AS $$
DECLARE
  automation RECORD;
  first_step RECORD;
  enrollment_exists BOOLEAN;
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
    -- Check if this deal is already enrolled in this automation
    SELECT EXISTS(
      SELECT 1 FROM automation_enrollments ae
      WHERE ae.automation_id = automation.id
        AND ae.deal_id = NEW.id
        AND ae.status IN ('active', 'paused')
    ) INTO enrollment_exists;

    -- Skip if already enrolled (don't double-enroll)
    IF enrollment_exists THEN
      CONTINUE;
    END IF;

    -- Get the first step of this automation
    SELECT * INTO first_step
    FROM automation_steps
    WHERE automation_id = automation.id
    ORDER BY step_order ASC
    LIMIT 1;

    -- Only enroll if automation has at least one step
    IF first_step IS NOT NULL THEN
      -- Calculate next_step_at based on first step's delay
      IF first_step.step_type = 'wait' THEN
        -- Wait steps: schedule for after the delay
        next_step_time := NOW() +
          ((COALESCE(first_step.delay_days, 0) * INTERVAL '1 day') +
           (COALESCE(first_step.delay_hours, 0) * INTERVAL '1 hour'));
      ELSE
        -- Email/SMS/move_to_stage steps: process immediately
        next_step_time := NOW();
      END IF;

      -- Create the enrollment
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

      -- Log the enrollment
      RAISE NOTICE 'Auto-enrolled deal % in automation % (triggered by stage change to %)',
        NEW.id, automation.name, NEW.current_stage_id;
    END IF;
  END LOOP;

  -- ============================================
  -- PART 2: EXIT CONDITIONS - Stop enrollments when deal moves to exit stage
  -- ============================================
  -- Only check exit conditions for UPDATE (not INSERT)
  IF TG_OP = 'UPDATE' THEN
    FOR existing_enrollment IN
      SELECT ae.id, ae.automation_id, a.stop_on_stage_ids, a.name
      FROM automation_enrollments ae
      JOIN automations a ON ae.automation_id = a.id
      WHERE ae.deal_id = NEW.id
        AND ae.status = 'active'
    LOOP
      -- Get the automation's exit stage IDs
      stop_stage_ids := existing_enrollment.stop_on_stage_ids;

      -- Check if the new stage is in the exit list
      IF stop_stage_ids IS NOT NULL AND NEW.current_stage_id = ANY(stop_stage_ids) THEN
        -- Stop the enrollment
        UPDATE automation_enrollments SET
          status = 'stopped',
          stopped_reason = 'Deal moved to exit stage',
          next_step_at = NULL
        WHERE id = existing_enrollment.id;

        -- Log the stop
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
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the trigger to include INSERT
DROP TRIGGER IF EXISTS on_deal_stage_change ON deals;

CREATE TRIGGER on_deal_stage_change
  AFTER INSERT OR UPDATE OF current_stage_id ON deals
  FOR EACH ROW
  EXECUTE FUNCTION handle_deal_stage_change();
