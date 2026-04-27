-- Migration: split exit-stage routing into TWO destinations based on whether
-- the contact engaged.
--
--   Replied      → exit_to_stage_id    (positive outcome, e.g. "Engaged")
--   No reply     → no_reply_stage_id   (negative outcome, e.g. "Lost", "Dead")
--
-- Existing migration 089 added a single `exit_to_stage_id`. Now we add a
-- second column for the "completed without reply" path. The trigger
-- (move_deal_on_enrollment_exit) picks which one to use from the enrollment
-- status: 'completed' = sequence finished without reply, 'stopped' with a
-- reply reason = engaged.

ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS no_reply_stage_id UUID
    REFERENCES pipeline_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_automations_no_reply_stage_id
  ON automations(no_reply_stage_id);

CREATE OR REPLACE FUNCTION move_deal_on_enrollment_exit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_stage_id UUID;
  exit_replied    UUID;
  exit_no_reply   UUID;
BEGIN
  -- Only act on transitions out of 'active'.
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('completed', 'stopped') THEN
    RETURN NEW;
  END IF;

  -- Skip manual admin unenrolls — leave the deal where it is.
  IF NEW.status = 'stopped' AND COALESCE(NEW.stopped_reason, '') ILIKE 'manual%' THEN
    RETURN NEW;
  END IF;

  IF NEW.deal_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Pull both possible destinations once.
  SELECT
    COALESCE(a.exit_to_stage_id, NULLIF(a.config->>'exit_to_stage_id','')::uuid),
    COALESCE(a.no_reply_stage_id, NULLIF(a.config->>'no_reply_stage_id','')::uuid)
  INTO exit_replied, exit_no_reply
  FROM automations a
  WHERE a.id = NEW.automation_id;

  -- Branch on outcome:
  --   * status = 'completed'  → no engagement, sequence ran to the end
  --   * status = 'stopped' with a reply-style reason → contact replied
  --   * any other 'stopped' (stop_on_stage, etc.) → fall back to the
  --     "engaged" stage; if not set, do nothing
  IF NEW.status = 'completed' THEN
    target_stage_id := exit_no_reply;
  ELSIF NEW.status = 'stopped' AND COALESCE(NEW.stopped_reason, '') ILIKE '%repl%' THEN
    target_stage_id := exit_replied;
  ELSE
    target_stage_id := exit_replied;
  END IF;

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
