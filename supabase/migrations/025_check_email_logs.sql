-- Function to check automation logs and email sends
CREATE OR REPLACE FUNCTION check_email_logs(p_deal_title text DEFAULT NULL)
RETURNS TABLE (
  log_id uuid,
  deal_title text,
  automation_name text,
  step_type text,
  log_status text,
  log_type text,
  error_message text,
  sent_at timestamptz,
  email_send_id uuid,
  email_status text,
  recipient_email text,
  resend_message_id text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id as log_id,
    d.title as deal_title,
    a.name as automation_name,
    s.step_type,
    al.status as log_status,
    al.log_type,
    al.error_message,
    al.sent_at,
    es.id as email_send_id,
    es.status as email_status,
    es.recipient_email,
    es.resend_message_id
  FROM automation_logs al
  JOIN automation_enrollments ae ON al.enrollment_id = ae.id
  JOIN deals d ON ae.deal_id = d.id
  JOIN automations a ON ae.automation_id = a.id
  LEFT JOIN automation_steps s ON al.step_id = s.id
  LEFT JOIN email_sends es ON al.id = es.automation_log_id
  WHERE (p_deal_title IS NULL OR d.title ILIKE '%' || p_deal_title || '%')
  ORDER BY al.sent_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_email_logs(text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_email_logs(text) TO anon;
