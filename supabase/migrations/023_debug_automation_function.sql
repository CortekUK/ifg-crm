-- Debug function to check automation trigger matching
-- This helps diagnose why automations aren't triggering

CREATE OR REPLACE FUNCTION debug_automation_matching()
RETURNS TABLE (
  deal_id uuid,
  deal_title text,
  deal_stage_id uuid,
  deal_stage_name text,
  deal_pipeline_id uuid,
  deal_pipeline_name text,
  automation_id uuid,
  automation_name text,
  automation_trigger_stage_id uuid,
  automation_trigger_stage_name text,
  automation_pipeline_id uuid,
  automation_is_active boolean,
  automation_trigger_type text,
  stage_matches boolean,
  pipeline_matches boolean,
  is_enrolled boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id as deal_id,
    d.title as deal_title,
    d.current_stage_id as deal_stage_id,
    ds.name as deal_stage_name,
    d.pipeline_id as deal_pipeline_id,
    dp.name as deal_pipeline_name,
    a.id as automation_id,
    a.name as automation_name,
    a.trigger_stage_id as automation_trigger_stage_id,
    ats.name as automation_trigger_stage_name,
    a.pipeline_id as automation_pipeline_id,
    a.is_active as automation_is_active,
    a.trigger_type as automation_trigger_type,
    (d.current_stage_id = a.trigger_stage_id) as stage_matches,
    (d.pipeline_id = a.pipeline_id) as pipeline_matches,
    EXISTS(
      SELECT 1 FROM automation_enrollments ae
      WHERE ae.deal_id = d.id
      AND ae.automation_id = a.id
    ) as is_enrolled
  FROM deals d
  LEFT JOIN pipeline_stages ds ON d.current_stage_id = ds.id
  LEFT JOIN pipelines dp ON d.pipeline_id = dp.id
  CROSS JOIN automations a
  LEFT JOIN pipeline_stages ats ON a.trigger_stage_id = ats.id
  ORDER BY d.created_at DESC, a.name
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION debug_automation_matching() TO authenticated;

-- Also create a simpler function to manually trigger enrollment
CREATE OR REPLACE FUNCTION manually_enroll_deal_in_automation(
  p_deal_id uuid,
  p_automation_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_first_step RECORD;
  v_enrollment_id uuid;
  v_next_step_time timestamptz;
BEGIN
  -- Get the first step of this automation
  SELECT * INTO v_first_step
  FROM automation_steps
  WHERE automation_id = p_automation_id
  ORDER BY step_order ASC
  LIMIT 1;

  IF v_first_step IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Automation has no steps');
  END IF;

  -- Calculate next_step_at
  IF v_first_step.step_type = 'wait' THEN
    v_next_step_time := NOW() +
      ((COALESCE(v_first_step.delay_days, 0) * INTERVAL '1 day') +
       (COALESCE(v_first_step.delay_hours, 0) * INTERVAL '1 hour'));
  ELSE
    v_next_step_time := NOW();
  END IF;

  -- Create enrollment
  INSERT INTO automation_enrollments (
    automation_id,
    deal_id,
    status,
    current_step_id,
    next_step_at,
    enrolled_at
  ) VALUES (
    p_automation_id,
    p_deal_id,
    'active',
    v_first_step.id,
    v_next_step_time,
    NOW()
  )
  RETURNING id INTO v_enrollment_id;

  RETURN jsonb_build_object(
    'success', true,
    'enrollment_id', v_enrollment_id,
    'next_step_at', v_next_step_time
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deal is already enrolled in this automation');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION manually_enroll_deal_in_automation(uuid, uuid) TO authenticated;
