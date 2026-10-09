-- QA-26 Issue 1: a Stage Reminder was only stopped when a PERSON moved the card.
--
-- QA's example: a player sitting in Document Collecting pays their deposit,
-- the payment moves the deal to Deposit Paid, and the reminder still goes out
-- days later asking for the documents they no longer need to send. The
-- template's own description promises the opposite.
--
-- The existing "Auto-stopped on stage move" stop is written by the pipeline
-- screen (board drag / deal panel), so it covers exactly one of the ways a
-- deal can change stage. This adds the same stop inside the database rule that
-- runs on EVERY stage change, so it no longer matters who moved it.
--
-- Rewritten in full because a trigger function cannot be patched in place.
-- Parts 1 and 2 are copied verbatim from the live definition; only Part 3 is
-- new. Idempotent.

CREATE OR REPLACE FUNCTION public.handle_deal_stage_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  automation RECORD;
  first_step RECORD;
  stop_stage_ids UUID[];
  next_step_time TIMESTAMPTZ;
  existing_status TEXT;
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

    -- Calculate next_step_at based on first step's delay
    IF first_step.step_type = 'wait' THEN
      next_step_time := NOW() +
        ((COALESCE(first_step.delay_days, 0) * INTERVAL '1 day') +
         (COALESCE(first_step.delay_hours, 0) * INTERVAL '1 hour'));
    ELSE
      next_step_time := NOW();
    END IF;

    -- Check existing enrollment status first
    SELECT status INTO existing_status
    FROM automation_enrollments
    WHERE automation_id = automation.id AND deal_id = NEW.id;

    -- If already active or paused, skip entirely
    IF existing_status IN ('active', 'paused') THEN
      RAISE NOTICE 'Deal % already enrolled in automation % with status %, skipping',
        NEW.id, automation.name, existing_status;
      CONTINUE;
    END IF;

    -- Use UPSERT: Insert new enrollment or update if stopped/completed
    INSERT INTO automation_enrollments (
      automation_id,
      deal_id,
      status,
      current_step_id,
      next_step_at,
      enrolled_at,
      completed_at,
      stopped_reason,
      send_as_user_id
    ) VALUES (
      automation.id,
      NEW.id,
      'active',
      first_step.id,
      next_step_time,
      NOW(),
      NULL,
      NULL,
      NULL
    )
    ON CONFLICT (automation_id, deal_id) DO UPDATE SET
      status = 'active',
      current_step_id = first_step.id,
      next_step_at = next_step_time,
      enrolled_at = NOW(),
      completed_at = NULL,
      stopped_reason = NULL,
      send_as_user_id = NULL
    WHERE automation_enrollments.status IN ('stopped', 'completed');

    RAISE NOTICE 'Enrolled/re-enrolled deal % in automation %', NEW.id, automation.name;
  END LOOP;

  -- ============================================
  -- PART 2: EXIT CONDITIONS - Stop enrollments when deal moves to exit stage
  -- ============================================
  FOR automation IN
    SELECT ae.id as enrollment_id, ae.automation_id, a.stop_on_stage_ids, a.name, ae.current_step_id
    FROM automation_enrollments ae
    JOIN automations a ON ae.automation_id = a.id
    WHERE ae.deal_id = NEW.id
      AND ae.status = 'active'
  LOOP
    stop_stage_ids := automation.stop_on_stage_ids;

    IF stop_stage_ids IS NOT NULL AND NEW.current_stage_id = ANY(stop_stage_ids) THEN
      UPDATE automation_enrollments SET
        status = 'stopped',
        stopped_reason = 'Deal moved to exit stage',
        next_step_at = NULL
      WHERE id = automation.enrollment_id;

      INSERT INTO automation_logs (
        enrollment_id,
        step_id,
        deal_id,
        status,
        sent_at,
        log_type,
        error_message
      ) VALUES (
        automation.enrollment_id,
        automation.current_step_id,
        NEW.id,
        'skipped',
        NOW(),
        'enrollment_stopped',
        'Deal moved to exit stage'
      );

      RAISE NOTICE 'Stopped enrollment % - deal % moved to exit stage %',
        automation.enrollment_id, NEW.id, NEW.current_stage_id;
    END IF;
  END LOOP;

  -- ============================================
  -- PART 3: A STAGE REMINDER ENDS WHEN THE DEAL LEAVES ITS STAGE — WHOEVER
  --         MOVED IT
  -- ============================================
  -- The Stage Reminder template promises "auto-stops if the deal moves to any
  -- other stage in the meantime". Until now that was only true when a PERSON
  -- moved the card: the pipeline screen wrote the "Auto-stopped on stage move"
  -- stop itself. Nothing did it when the SYSTEM moved the deal — a Stripe
  -- payment landing it on Deposit Paid, a reply moving it to Contact Response,
  -- or another automation's stage move.
  --
  -- Part 2 above is no help: it only fires when the destination happens to be
  -- listed in that automation's own exit stages (Goal 2), which for a nudge
  -- aimed at one stage it usually is not. So a player who paid their deposit
  -- could still be chased with "please send your documents" days later.
  --
  -- Scoped to stage_reminder on purpose. The other templates are sequences
  -- that legitimately follow a player across stages, and stopping them on any
  -- stage change would break them. A stage reminder is the one template whose
  -- entire premise is "you are still sitting in THIS stage".
  --
  -- The reason string is deliberately identical to the one the board writes,
  -- so the enrolment reads the same however the deal moved. It contains no
  -- "repl" and is not "manual%", so move_deal_on_enrollment_exit takes its
  -- "stopped for a reason that says nothing about the contact" branch and
  -- leaves the card exactly where it was put.
  FOR automation IN
    SELECT ae.id AS enrollment_id, ae.current_step_id, a.name
    FROM automation_enrollments ae
    JOIN automations a ON a.id = ae.automation_id
    WHERE ae.deal_id = NEW.id
      AND ae.status = 'active'
      AND a.automation_type = 'stage_reminder'
      -- Not the one Part 1 may have just created for the stage the deal has
      -- arrived on; only reminders anchored to a stage it has now left.
      AND a.trigger_stage_id IS DISTINCT FROM NEW.current_stage_id
  LOOP
    UPDATE automation_enrollments SET
      status = 'stopped',
      stopped_reason = 'Auto-stopped on stage move',
      next_step_at = NULL
    WHERE id = automation.enrollment_id;

    INSERT INTO automation_logs (
      enrollment_id, step_id, deal_id, status, sent_at, log_type, error_message
    ) VALUES (
      automation.enrollment_id, automation.current_step_id, NEW.id,
      'skipped', NOW(), 'enrollment_stopped', 'Auto-stopped on stage move'
    );
  END LOOP;

  RETURN NEW;
END;
$function$

