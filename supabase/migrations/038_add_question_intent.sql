-- Migration: Add 'question' to AI intent enum
-- This adds a new intent category for replies that contain questions requiring human response

-- For email_replies table - alter the check constraint
ALTER TABLE email_replies DROP CONSTRAINT IF EXISTS email_replies_ai_intent_check;
ALTER TABLE email_replies ADD CONSTRAINT email_replies_ai_intent_check
  CHECK (ai_intent IN ('positive', 'negative', 'neutral', 'question', 'unknown'));

-- For sms_messages table - alter the check constraint
ALTER TABLE sms_messages DROP CONSTRAINT IF EXISTS sms_messages_ai_intent_check;
ALTER TABLE sms_messages ADD CONSTRAINT sms_messages_ai_intent_check
  CHECK (ai_intent IN ('positive', 'negative', 'neutral', 'question', 'unknown'));

-- Add comment for documentation
COMMENT ON COLUMN email_replies.ai_intent IS 'AI-classified intent: positive (interested), negative (opt-out), neutral (no clear sentiment), question (needs human response), unknown (not classified)';
COMMENT ON COLUMN sms_messages.ai_intent IS 'AI-classified intent: positive (interested), negative (opt-out), neutral (no clear sentiment), question (needs human response), unknown (not classified)';
