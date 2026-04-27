-- Migration: when an automation exits via reply, move the deal to a
-- configured "next" stage in the pipeline.
--
-- Context: today the trigger sets the enrollment to 'stopped', but the deal
-- itself stays in whatever stage it was when the email went out. Recruiters
-- end up manually shuffling deals from "Initial Contact" to the next column
-- after every reply. This puts that move inside the trigger so it's atomic
-- with the stop.
--
-- New column on automations.exit_to_stage_id (nullable, FK with SET NULL on
-- stage delete so dropping a stage doesn't cascade-break automations).
-- Trigger reads it via the same COALESCE-pattern we use for exit_on_reply
-- (top-level column wins, falls back to config JSON).

ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS exit_to_stage_id UUID
    REFERENCES pipeline_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_automations_exit_to_stage_id
  ON automations(exit_to_stage_id);

CREATE OR REPLACE FUNCTION stop_enrollments_on_reply_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_enrollment_id UUID;
  target_deal_id       UUID;
  target_exit_stage    UUID;
  stop_reason          TEXT;
BEGIN
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.contact_id IS NOT DISTINCT FROM NEW.contact_id THEN
    RETURN NEW;
  END IF;

  -- Path 1: exact thread match.
  IF NEW.email_send_id IS NOT NULL THEN
    SELECT al.enrollment_id,
           al.deal_id,
           COALESCE(a.exit_to_stage_id, NULLIF(a.config->>'exit_to_stage_id','')::uuid)
    INTO target_enrollment_id, target_deal_id, target_exit_stage
    FROM email_sends es
    JOIN automation_logs al ON es.automation_log_id = al.id
    JOIN automation_enrollments ae ON ae.id = al.enrollment_id
    JOIN automations a ON ae.automation_id = a.id
    WHERE es.id = NEW.email_send_id
      AND ae.status = 'active'
      AND COALESCE(a.exit_on_reply, (a.config->>'exit_on_reply')::boolean, true) = true
    LIMIT 1;

    IF target_enrollment_id IS NOT NULL THEN
      stop_reason := 'Contact replied to email';
    END IF;
  END IF;

  -- Path 2: most-recent-send fallback.
  IF target_enrollment_id IS NULL THEN
    SELECT al.enrollment_id,
           al.deal_id,
           COALESCE(a.exit_to_stage_id, NULLIF(a.config->>'exit_to_stage_id','')::uuid)
    INTO target_enrollment_id, target_deal_id, target_exit_stage
    FROM email_sends es
    JOIN automation_logs al ON es.automation_log_id = al.id
    JOIN automation_enrollments ae ON ae.id = al.enrollment_id
    JOIN automations a ON ae.automation_id = a.id
    WHERE es.recipient_contact_id = NEW.contact_id
      AND ae.status = 'active'
      AND COALESCE(a.exit_on_reply, (a.config->>'exit_on_reply')::boolean, true) = true
      AND es.sent_at > now() - interval '30 days'
    ORDER BY es.sent_at DESC
    LIMIT 1;

    IF target_enrollment_id IS NOT NULL THEN
      stop_reason := 'Replied (matched by most recent send — thread headers missing)';
    END IF;
  END IF;

  IF target_enrollment_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE automation_enrollments
  SET status         = 'stopped',
      stopped_reason = stop_reason,
      next_step_at   = NULL
  WHERE id = target_enrollment_id;

  INSERT INTO automation_logs (enrollment_id, deal_id, status, sent_at, log_type, error_message)
  VALUES (target_enrollment_id, target_deal_id, 'skipped', now(), 'enrollment_stopped', stop_reason);

  -- Move the deal to the configured exit stage. Only when one is set and the
  -- deal isn't already there — avoids a no-op write that would still tick
  -- updated_at and audit triggers.
  IF target_exit_stage IS NOT NULL AND target_deal_id IS NOT NULL THEN
    UPDATE deals
    SET current_stage_id = target_exit_stage
    WHERE id = target_deal_id
      AND current_stage_id IS DISTINCT FROM target_exit_stage;
  END IF;

  UPDATE email_replies
  SET processed = true
  WHERE id = NEW.id
    AND processed = false;

  RETURN NEW;
END;
$$;
