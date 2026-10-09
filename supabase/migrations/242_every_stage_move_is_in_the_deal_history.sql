-- QA-44 new issue 2: a move the user caused but the DATABASE carried out was
-- in nobody's history.
--
-- Migration 235 gave the deal panel its missing entries for system moves, but
-- guarded on auth.uid() IS NULL to avoid doubling up with the pipeline
-- screen's own insert. That split stage moves into two cases and missed a
-- third:
--
--   board drag       user,    written by the screen       logged
--   Stripe webhook   no user, written by a trigger        logged (235)
--   Mark Paid        USER,    written by a trigger        logged by NOBODY
--
-- QA marked an invoice paid, watched the card move to Deposit Paid, and found
-- the deal's history still ending two days earlier.
--
-- Guarding on who did it was the wrong fix; two writers for one fact was the
-- problem. There is now one: the database writes every stage move, however it
-- was caused, and the screen's insert is removed (lib/hooks/useDeals.ts).
-- auth.uid() still chooses the wording — "Moved from X to Y" for a person,
-- "Moved to X automatically" for the system — and supplies the attribution.
--
-- Parts 1-3 are reproduced verbatim from the live definition (a plpgsql body
-- cannot be patched in place), so this also pins the migration 226 Stage
-- Reminder fix and the migration 236 once-per-deal guard into the repo.

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
    SELECT a.id, a.name, a.config, a.stop_on_stage_ids, a.automation_type
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

    -- ONCE PER DEAL: a confirmation is not a sequence.
    --
    -- Moving a player out of a stage and back in re-ran the automation on it,
    -- because the UPSERT below revives a 'stopped' or 'completed' enrolment.
    -- For a drip sequence that is right — a recruiter dragging a card back to
    -- Initial Lead means "start chasing again". For a one-off acknowledgement
    -- it is not: QA moved a player Application -> Reg Form received ->
    -- Application and the "we have received your application" email was sent
    -- twice (QA-20), and the same for the Interview thank-you (QA-22).
    --
    -- Any previous enrolment at all is enough to stop a second send, so this
    -- holds however the card has been shuffled since.
    IF automation.automation_type IN ('application_received', 'post_interview')
       AND existing_status IS NOT NULL THEN
      RAISE NOTICE 'Deal % already had automation % once; not sending again',
        NEW.id, automation.name;
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

  -- ============================================
  -- PART 4: EVERY STAGE MOVE IS WRITTEN TO THE DEAL'S OWN HISTORY
  -- ============================================
  -- The deal panel reads `deal_activities`, and this is now the ONLY thing
  -- that writes a 'stage_changed' row to it.
  --
  -- It used to fire only when auth.uid() was NULL, on the reasoning that the
  -- pipeline screen logged human moves itself. That left a third case logged by
  -- nobody: a move a person triggered that the DATABASE carried out. Marking an
  -- invoice paid is exactly that — the click is the user's, so auth.uid() is
  -- set and this skipped, while the screen never knew the stage had changed
  -- because a trigger moved it. QA marked an invoice paid, the card went to
  -- Deposit Paid, and the deal's history still ended days earlier (QA-44).
  --
  -- Guarding on "who did it" was the wrong idea; two writers for one fact was
  -- the problem. The database sees every move however it was caused, so it
  -- writes them all and the screen's own insert has been removed
  -- (lib/hooks/useDeals.ts). auth.uid() still decides the WORDING and the
  -- attribution, which is the part it is actually good for.
  --
  -- UPDATE only: a new deal gets a 'deal_created' entry instead.
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO deal_activities (deal_id, activity_type, description, old_value, new_value, performed_by_id)
    VALUES (
      NEW.id,
      'stage_changed',
      CASE
        WHEN auth.uid() IS NULL THEN
          'Moved to ' || COALESCE(
            (SELECT s.name FROM pipeline_stages s WHERE s.id = NEW.current_stage_id),
            'another stage'
          ) || ' automatically'
        ELSE
          'Moved from ' || COALESCE(
            (SELECT s.name FROM pipeline_stages s WHERE s.id = OLD.current_stage_id), 'no stage'
          ) || ' to ' || COALESCE(
            (SELECT s.name FROM pipeline_stages s WHERE s.id = NEW.current_stage_id), 'another stage'
          )
      END,
      jsonb_build_object(
        'stage_id', OLD.current_stage_id,
        'stage_name', (SELECT s.name FROM pipeline_stages s WHERE s.id = OLD.current_stage_id)
      ),
      jsonb_build_object(
        'stage_id', NEW.current_stage_id,
        'stage_name', (SELECT s.name FROM pipeline_stages s WHERE s.id = NEW.current_stage_id)
      ),
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$function$
