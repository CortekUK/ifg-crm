-- Add 'deal_created' to match_status CHECK constraint so replies move out of Matched tab after Smart Deal

-- Fix legacy rows with bare 'matched' value
UPDATE email_replies SET match_status = 'manually_matched' WHERE match_status = 'matched';

ALTER TABLE email_replies DROP CONSTRAINT IF EXISTS email_replies_match_status_check;
ALTER TABLE email_replies ADD CONSTRAINT email_replies_match_status_check
  CHECK (match_status IN ('auto_matched', 'manually_matched', 'unmatched', 'spam', 'deal_created'));

ALTER TABLE sms_messages DROP CONSTRAINT IF EXISTS sms_messages_match_status_check;
ALTER TABLE sms_messages ADD CONSTRAINT sms_messages_match_status_check
  CHECK (match_status IN ('auto_matched', 'manually_matched', 'unmatched', 'spam', 'deal_created'));
