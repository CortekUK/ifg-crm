-- Function to check enrollment status for a specific deal
CREATE OR REPLACE FUNCTION check_enrollment_status(p_deal_title text DEFAULT NULL)
RETURNS TABLE (
  enrollment_id uuid,
  deal_id uuid,
  deal_title text,
  automation_id uuid,
  automation_name text,
  enrollment_status text,
  current_step_id uuid,
  step_type text,
  step_order int,
  next_step_at timestamptz,
  enrolled_at timestamptz,
  stopped_reason text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ae.id as enrollment_id,
    ae.deal_id,
    d.title as deal_title,
    ae.automation_id,
    a.name as automation_name,
    ae.status as enrollment_status,
    ae.current_step_id,
    s.step_type,
    s.step_order,
    ae.next_step_at,
    ae.enrolled_at,
    ae.stopped_reason
  FROM automation_enrollments ae
  JOIN deals d ON ae.deal_id = d.id
  JOIN automations a ON ae.automation_id = a.id
  LEFT JOIN automation_steps s ON ae.current_step_id = s.id
  WHERE (p_deal_title IS NULL OR d.title ILIKE '%' || p_deal_title || '%')
  ORDER BY ae.enrolled_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_enrollment_status(text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_enrollment_status(text) TO anon;

-- Function to check automation steps
CREATE OR REPLACE FUNCTION check_automation_steps(p_automation_name text DEFAULT NULL)
RETURNS TABLE (
  automation_id uuid,
  automation_name text,
  automation_is_active boolean,
  step_id uuid,
  step_order int,
  step_type text,
  delay_days int,
  delay_hours int,
  email_template_id uuid,
  template_name text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id as automation_id,
    a.name as automation_name,
    a.is_active as automation_is_active,
    s.id as step_id,
    s.step_order,
    s.step_type,
    s.delay_days,
    s.delay_hours,
    s.email_template_id,
    et.name as template_name
  FROM automations a
  LEFT JOIN automation_steps s ON a.id = s.automation_id
  LEFT JOIN email_templates et ON s.email_template_id = et.id
  WHERE (p_automation_name IS NULL OR a.name ILIKE '%' || p_automation_name || '%')
  ORDER BY a.name, s.step_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_automation_steps(text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_automation_steps(text) TO anon;
