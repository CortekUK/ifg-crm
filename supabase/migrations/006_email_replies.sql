-- Migration: Email Replies table for tracking contact responses
-- This enables stopping automations when contacts reply

-- Create email_replies table
CREATE TABLE IF NOT EXISTS email_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email_send_id UUID REFERENCES email_sends(id) ON DELETE SET NULL,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subject TEXT,
  body_preview TEXT,
  from_email TEXT,
  message_id TEXT,
  in_reply_to TEXT,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_email_replies_contact_id ON email_replies(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_email_send_id ON email_replies(email_send_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_processed ON email_replies(processed) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_email_replies_received_at ON email_replies(received_at);

-- Add RLS policies
ALTER TABLE email_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view email replies" ON email_replies
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert email replies" ON email_replies
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update email replies" ON email_replies
  FOR UPDATE TO authenticated USING (true);

-- Add exit_on_reply column to automations config tracking
-- (The config already supports exit_on_reply in the JSON, this adds a dedicated column for faster queries)
ALTER TABLE automations ADD COLUMN IF NOT EXISTS exit_on_reply BOOLEAN DEFAULT TRUE;

-- Update existing automations to have exit_on_reply = true by default
UPDATE automations SET exit_on_reply = TRUE WHERE exit_on_reply IS NULL;

-- Create function to check if a contact has replied to automation emails
CREATE OR REPLACE FUNCTION has_contact_replied_to_automation(
  p_contact_id UUID,
  p_automation_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  reply_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 
    FROM email_replies er
    JOIN email_sends es ON er.email_send_id = es.id
    JOIN automation_logs al ON es.automation_log_id = al.id
    JOIN automation_steps ast ON al.step_id = ast.id
    WHERE er.contact_id = p_contact_id
      AND ast.automation_id = p_automation_id
      AND er.received_at > es.sent_at
  ) INTO reply_exists;
  
  RETURN reply_exists;
END;
$$ LANGUAGE plpgsql;

-- Create view for unprocessed replies that should stop automations
CREATE OR REPLACE VIEW pending_reply_stops AS
SELECT 
  er.id AS reply_id,
  er.contact_id,
  ae.id AS enrollment_id,
  ae.automation_id,
  a.name AS automation_name,
  c.first_name || ' ' || c.last_name AS contact_name
FROM email_replies er
JOIN email_sends es ON er.email_send_id = es.id
JOIN automation_logs al ON es.automation_log_id = al.id
JOIN automation_steps ast ON al.step_id = ast.id
JOIN automations a ON ast.automation_id = a.id
JOIN automation_enrollments ae ON ae.automation_id = a.id AND ae.deal_id = al.deal_id
JOIN deals d ON ae.deal_id = d.id
JOIN contacts c ON d.contact_id = c.id
WHERE ae.status = 'active'
  AND er.processed = FALSE
  AND (a.exit_on_reply = TRUE OR (a.config->>'exit_on_reply')::boolean = TRUE);
