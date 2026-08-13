-- The system super-admin operates the CRM but is not a recruiter and must
-- never receive manual or round-robin deal ownership.

-- Remove existing ownership first. Deals deliberately remain in their stage
-- as unassigned so an administrator can choose the appropriate recruiter.
WITH excluded_deals AS (
  UPDATE deals d
  SET deal_owner_id = NULL,
      owner_id = NULL
  FROM profiles p
  WHERE p.id = d.deal_owner_id
    AND lower(p.email) = 'superadmin@theinternationalfootballgroup.com'
  RETURNING d.id
)
INSERT INTO deal_activities (deal_id, activity_type, description)
SELECT id, 'owner_changed', 'Owner removed: system super-admin is excluded from deal ownership'
FROM excluded_deals;

CREATE OR REPLACE FUNCTION prevent_excluded_deal_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deal_owner_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = NEW.deal_owner_id
      AND lower(p.email) = 'superadmin@theinternationalfootballgroup.com'
  ) THEN
    RAISE EXCEPTION 'This system administrator cannot be assigned as a deal owner'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_excluded_deal_owner_trigger ON deals;
CREATE TRIGGER prevent_excluded_deal_owner_trigger
  BEFORE INSERT OR UPDATE OF deal_owner_id ON deals
  FOR EACH ROW
  EXECUTE FUNCTION prevent_excluded_deal_owner();

-- Filter excluded accounts inside the shared round-robin RPC as the final
-- assignment safeguard, including for saved automation configurations that
-- may still contain the account UUID.
CREATE OR REPLACE FUNCTION round_robin_next(
  p_context_type TEXT,
  p_context_id UUID,
  p_user_ids UUID[]
) RETURNS UUID AS $$
DECLARE
  v_eligible_user_ids UUID[];
  v_last_user_id UUID;
  v_last_index INTEGER;
  v_next_index INTEGER;
  v_next_user_id UUID;
BEGIN
  SELECT array_agg(candidate.user_id ORDER BY candidate.ordinality)
  INTO v_eligible_user_ids
  FROM unnest(p_user_ids) WITH ORDINALITY AS candidate(user_id, ordinality)
  JOIN profiles p ON p.id = candidate.user_id
  WHERE lower(p.email) <> 'superadmin@theinternationalfootballgroup.com';

  IF v_eligible_user_ids IS NULL OR array_length(v_eligible_user_ids, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT last_assigned_user_id INTO v_last_user_id
  FROM round_robin_cursors
  WHERE context_type = p_context_type AND context_id = p_context_id;

  IF v_last_user_id IS NULL THEN
    v_next_user_id := v_eligible_user_ids[1];
  ELSE
    v_last_index := array_position(v_eligible_user_ids, v_last_user_id);
    IF v_last_index IS NULL THEN
      v_next_index := 1;
    ELSE
      v_next_index := v_last_index + 1;
      IF v_next_index > array_length(v_eligible_user_ids, 1) THEN
        v_next_index := 1;
      END IF;
    END IF;
    v_next_user_id := v_eligible_user_ids[v_next_index];
  END IF;

  INSERT INTO round_robin_cursors (
    context_type, context_id, last_assigned_user_id, last_assigned_at, updated_at
  ) VALUES (
    p_context_type, p_context_id, v_next_user_id, now(), now()
  )
  ON CONFLICT (context_type, context_id) DO UPDATE SET
    last_assigned_user_id = v_next_user_id,
    last_assigned_at = now(),
    updated_at = now();

  RETURN v_next_user_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prevent_excluded_deal_owner IS
  'Rejects deal ownership by CRM-only system administrator accounts.';
