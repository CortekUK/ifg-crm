-- Migration: move the deal to automation.exit_to_stage_id whenever an
-- enrollment leaves 'active' for any of:
--   * completed  — sequence finished without reply
--   * stopped    — reply, stop_on_stage, or other auto exit
--
-- Migration 089 only moved the deal when a reply landed. That covers the
-- "contact replied" path but leaves "automation finished naturally" and
-- "deal moved into a stop_on_stage" without any auto stage-progression.
-- This trigger handles all three uniformly so the recruiter never has to
-- shuffle deals manually after an automation ends.
--
-- Does NOT fire on manual unenrolls (stopped_reason starts with "Manual")
-- — those are admin overrides and should leave the deal alone.

CREATE OR REPLACE FUNCTION move_deal_on_enrollment_exit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_stage_id UUID;
BEGIN
  -- Only act on active → terminal transitions.
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('completed', 'stopped') THEN
    RETURN NEW;
  END IF;

  -- Skip manual unenrolls — admin moved the deal themselves (or doesn't want
  -- it moved). Heuristic check on stopped_reason text. Anything else
  -- (reply, stage exit, completion) is treated as automatic.
  IF NEW.status = 'stopped' AND COALESCE(NEW.stopped_reason, '') ILIKE 'manual%' THEN
    RETURN NEW;
  END IF;

  -- No deal to move.
  IF NEW.deal_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve exit_to_stage_id from automation (top-level column → config JSON
  -- fallback, matching the COALESCE pattern used elsewhere).
  SELECT COALESCE(a.exit_to_stage_id, NULLIF(a.config->>'exit_to_stage_id','')::uuid)
  INTO target_stage_id
  FROM automations a
  WHERE a.id = NEW.automation_id;

  IF target_stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE deals
  SET current_stage_id = target_stage_id
  WHERE id = NEW.deal_id
    AND current_stage_id IS DISTINCT FROM target_stage_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS automation_enrollment_exit_moves_deal ON automation_enrollments;
CREATE TRIGGER automation_enrollment_exit_moves_deal
AFTER UPDATE OF status ON automation_enrollments
FOR EACH ROW
EXECUTE FUNCTION move_deal_on_enrollment_exit();

-- The reply-based trigger from migration 089 also moved the deal directly.
-- Now that automation_enrollment_exit_moves_deal handles every termination
-- path, the reply trigger only needs to flip the enrollment status — the
-- new trigger picks up the cascade. Strip the redundant UPDATE deals call
-- from stop_enrollments_on_reply_match so we don't double-write.
CREATE OR REPLACE FUNCTION stop_enrollments_on_reply_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_enrollment_id UUID;
  target_deal_id       UUID;
  stop_reason          TEXT;
BEGIN
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.contact_id IS NOT DISTINCT FROM NEW.contact_id THEN
    RETURN NEW;
  END IF;

  IF NEW.email_send_id IS NOT NULL THEN
    SELECT al.enrollment_id, al.deal_id
    INTO target_enrollment_id, target_deal_id
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

  IF target_enrollment_id IS NULL THEN
    SELECT al.enrollment_id, al.deal_id
    INTO target_enrollment_id, target_deal_id
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

  -- Flipping the status fires automation_enrollment_exit_moves_deal which
  -- handles the deal stage move. Keep this function focused on the reply
  -- → stop transition.
  UPDATE automation_enrollments
  SET status         = 'stopped',
      stopped_reason = stop_reason,
      next_step_at   = NULL
  WHERE id = target_enrollment_id;

  INSERT INTO automation_logs (enrollment_id, deal_id, status, sent_at, log_type, error_message)
  VALUES (target_enrollment_id, target_deal_id, 'skipped', now(), 'enrollment_stopped', stop_reason);

  UPDATE email_replies
  SET processed = true
  WHERE id = NEW.id
    AND processed = false;

  RETURN NEW;
END;
$$;
