-- Fix email_sends status CHECK constraint to include all webhook statuses
-- The existing constraint may not include 'delivered', 'opened', 'clicked', etc.
ALTER TABLE email_sends DROP CONSTRAINT IF EXISTS email_sends_status_check;
ALTER TABLE email_sends ADD CONSTRAINT email_sends_status_check
  CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed', 'delayed'));
