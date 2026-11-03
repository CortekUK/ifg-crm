-- Move a deal to another pipeline without deleting and recreating it.
--
-- People change their minds on calls, and recreating the deal lost its notes
-- and history. Those hang off the deal's id, so they stay when it moves.
--
-- What the move has to do beyond changing the pipeline:
--   - stop the old pipeline's automations, or they keep emailing about the
--     programme the player just left
--   - enter the new pipeline's chain: handle_deal_stage_change enrols the deal
--     in whatever triggers on the stage it lands on, so that part is the
--     existing trigger, not a second copy of its rules
--   - join the new pipeline's list, which until now happened on INSERT only
--   - keep the Replies screen filing its mail under the right pipeline
--
-- SECURITY DEFINER because enrolments and mail rows are not all writable by a
-- recruiter. The permission check mirrors deals_update_policy.

CREATE OR REPLACE FUNCTION public.move_deal_to_pipeline(
  p_deal_id uuid,
  p_pipeline_id uuid,
  p_stage_id uuid,
  p_deal_value numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deal RECORD;
  from_name text;
  to_name text;
  next_position double precision;
BEGIN
  SELECT id, contact_id, pipeline_id, deal_owner_id, status INTO deal
  FROM deals WHERE id = p_deal_id FOR UPDATE;

  IF deal.id IS NULL THEN
    RAISE EXCEPTION 'This deal no longer exists.';
  END IF;
  -- IS NOT TRUE, not NOT: for a login with no profile is_admin() is NULL, and
  -- NOT NULL would skip this check.
  IF (public.is_admin() OR deal.deal_owner_id = auth.uid()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Only an admin or the deal owner can move this deal.';
  END IF;
  IF deal.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Only an open deal can be moved. Reopen it first.';
  END IF;
  IF deal.pipeline_id = p_pipeline_id THEN
    RAISE EXCEPTION 'The deal is already in that pipeline.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pipeline_stages WHERE id = p_stage_id AND pipeline_id = p_pipeline_id
  ) THEN
    RAISE EXCEPTION 'That stage is not in the chosen pipeline.';
  END IF;

  SELECT name INTO from_name FROM pipelines WHERE id = deal.pipeline_id;
  SELECT name INTO to_name FROM pipelines WHERE id = p_pipeline_id;

  -- deals_contact_id_pipeline_id_key allows one deal per contact per pipeline.
  IF EXISTS (
    SELECT 1 FROM deals
    WHERE contact_id = deal.contact_id AND pipeline_id = p_pipeline_id
  ) THEN
    RAISE EXCEPTION 'This contact already has a deal in %. Open that deal instead.', to_name;
  END IF;

  -- Old chain first, so nothing can send between the two steps.
  WITH stopped AS (
    UPDATE automation_enrollments e
    SET status = 'stopped',
        stopped_reason = 'Deal moved to another pipeline',
        next_step_at = NULL
    FROM automations a
    WHERE e.automation_id = a.id
      AND e.deal_id = deal.id
      AND e.status IN ('active', 'paused')
      AND a.pipeline_id = deal.pipeline_id
    RETURNING e.id, e.current_step_id
  )
  INSERT INTO automation_logs (enrollment_id, step_id, deal_id, status, sent_at, log_type, error_message)
  SELECT id, current_step_id, deal.id, 'skipped', NOW(), 'enrollment_stopped', 'Deal moved to another pipeline'
  FROM stopped;

  -- Top of the new column, where the person who just moved it will look.
  SELECT COALESCE(MIN(board_position), 0) - 1 INTO next_position
  FROM deals WHERE current_stage_id = p_stage_id;

  UPDATE deals
  SET pipeline_id = p_pipeline_id,
      current_stage_id = p_stage_id,
      board_position = next_position,
      deal_value = COALESCE(p_deal_value, deal_value)
  WHERE id = deal.id;

  UPDATE email_threads SET pipeline_id = p_pipeline_id WHERE deal_id = deal.id;
  UPDATE email_replies SET pipeline_id = p_pipeline_id WHERE deal_id = deal.id;

  INSERT INTO deal_activities (deal_id, activity_type, description, old_value, new_value, performed_by_id)
  VALUES (deal.id, 'stage_changed', 'Moved from ' || from_name || ' to ' || to_name, to_jsonb(from_name), to_jsonb(to_name), auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.move_deal_to_pipeline(uuid, uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_deal_to_pipeline(uuid, uuid, uuid, numeric) TO authenticated;

-- A moved deal joins the new pipeline's list the same way a new one does. The
-- function is already safe to run twice (ON CONFLICT DO NOTHING).
DROP TRIGGER IF EXISTS deal_sync_to_pipeline_list ON deals;
CREATE TRIGGER deal_sync_to_pipeline_list
  AFTER INSERT OR UPDATE OF pipeline_id ON deals
  FOR EACH ROW
  EXECUTE FUNCTION sync_deal_to_pipeline_list();
