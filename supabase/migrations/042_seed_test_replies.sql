-- Seed test replies for Smart Match testing
-- This migration adds test email replies and SMS messages

-- First, ensure we have a campaign with pipeline_id for testing
-- Get the first active pipeline
DO $$
DECLARE
  v_pipeline_id UUID;
  v_campaign_id UUID;
BEGIN
  -- Get first pipeline
  SELECT id INTO v_pipeline_id FROM pipelines WHERE is_active = true LIMIT 1;

  -- Create a test campaign linked to this pipeline if it doesn't exist
  INSERT INTO campaigns (
    name, type, status, from_user_id, created_by_id, pipeline_id
  )
  SELECT
    'US Soccer Programme Outreach', 'email', 'sent',
    (SELECT id FROM profiles LIMIT 1),
    (SELECT id FROM profiles LIMIT 1),
    v_pipeline_id
  WHERE NOT EXISTS (
    SELECT 1 FROM campaigns WHERE name = 'US Soccer Programme Outreach'
  )
  RETURNING id INTO v_campaign_id;

  -- If campaign already existed, get its id
  IF v_campaign_id IS NULL THEN
    SELECT id INTO v_campaign_id FROM campaigns WHERE name = 'US Soccer Programme Outreach' LIMIT 1;
  END IF;

  -- Update the campaign to have the pipeline_id if it was null
  UPDATE campaigns SET pipeline_id = v_pipeline_id WHERE id = v_campaign_id AND pipeline_id IS NULL;

END $$;

-- Insert test email replies (unmatched)
INSERT INTO email_replies (from_email, from_name, subject, body_preview, campaign_id, ai_intent, match_status, follow_up_status, received_at)
SELECT
  'james.wilson@gmail.com',
  'James Wilson',
  'Re: US Soccer Programme Opportunity',
  'Hi, I''m very interested in learning more about this opportunity. I''m currently playing for my school team and looking to take my game to the next level. Could you tell me more about the application process?',
  (SELECT id FROM campaigns WHERE name = 'US Soccer Programme Outreach' LIMIT 1),
  'positive',
  'unmatched',
  'open',
  NOW() - INTERVAL '2 hours'
WHERE NOT EXISTS (SELECT 1 FROM email_replies WHERE from_email = 'james.wilson@gmail.com');

INSERT INTO email_replies (from_email, from_name, subject, body_preview, campaign_id, ai_intent, match_status, follow_up_status, received_at)
SELECT
  'sarah.thompson@outlook.com',
  'Sarah Thompson',
  'Re: Soccer Scholarship Info',
  'Thanks for reaching out! My son is very interested in the programme. He''s currently in his junior year and plays striker. When is the next intake?',
  (SELECT id FROM campaigns WHERE name = 'US Soccer Programme Outreach' LIMIT 1),
  'positive',
  'unmatched',
  'open',
  NOW() - INTERVAL '5 hours'
WHERE NOT EXISTS (SELECT 1 FROM email_replies WHERE from_email = 'sarah.thompson@outlook.com');

INSERT INTO email_replies (from_email, from_name, subject, body_preview, campaign_id, ai_intent, match_status, follow_up_status, received_at)
SELECT
  'david.chen@yahoo.com',
  'David Chen',
  'Re: International Football Programme',
  'Not interested at this time, please remove me from your list. Thanks',
  (SELECT id FROM campaigns WHERE name = 'US Soccer Programme Outreach' LIMIT 1),
  'negative',
  'unmatched',
  'open',
  NOW() - INTERVAL '1 day'
WHERE NOT EXISTS (SELECT 1 FROM email_replies WHERE from_email = 'david.chen@yahoo.com');

INSERT INTO email_replies (from_email, from_name, subject, body_preview, campaign_id, ai_intent, match_status, follow_up_status, received_at)
SELECT
  'emma.rodriguez@hotmail.com',
  'Emma Rodriguez',
  'Re: Football Opportunity in the US',
  'What are the costs involved? And do you offer any scholarships or financial aid options? Also, is there accommodation provided?',
  (SELECT id FROM campaigns WHERE name = 'US Soccer Programme Outreach' LIMIT 1),
  'question',
  'unmatched',
  'open',
  NOW() - INTERVAL '3 hours'
WHERE NOT EXISTS (SELECT 1 FROM email_replies WHERE from_email = 'emma.rodriguez@hotmail.com');

INSERT INTO email_replies (from_email, from_name, subject, body_preview, campaign_id, ai_intent, match_status, follow_up_status, received_at)
SELECT
  'alex.kumar@gmail.com',
  'Alex Kumar',
  'Re: US Soccer Programme',
  'This sounds amazing! I''ve been dreaming of playing football in America for years. I''m currently playing for my local academy in the UK. How do I apply?',
  (SELECT id FROM campaigns WHERE name = 'US Soccer Programme Outreach' LIMIT 1),
  'positive',
  'unmatched',
  'open',
  NOW() - INTERVAL '30 minutes'
WHERE NOT EXISTS (SELECT 1 FROM email_replies WHERE from_email = 'alex.kumar@gmail.com');

-- Insert email reply without campaign (generic reply)
INSERT INTO email_replies (from_email, from_name, subject, body_preview, ai_intent, match_status, follow_up_status, received_at)
SELECT
  'tom.brady@email.com',
  'Tom Brady',
  'Enquiry about your services',
  'Hi, I found your website and wanted to learn more about what you offer. My nephew is interested in football programmes. Can someone call me back?',
  'positive',
  'unmatched',
  'open',
  NOW() - INTERVAL '4 hours'
WHERE NOT EXISTS (SELECT 1 FROM email_replies WHERE from_email = 'tom.brady@email.com');

-- Insert test SMS messages (unmatched)
INSERT INTO sms_messages (phone_number, direction, content, pipeline_id, ai_intent, match_status, follow_up_status)
SELECT
  '+447911123456',
  'inbound',
  'Hi yes I got your message about the US football programme. Very interested! When can we chat?',
  (SELECT id FROM pipelines WHERE is_active = true LIMIT 1),
  'positive',
  'unmatched',
  'open'
WHERE NOT EXISTS (SELECT 1 FROM sms_messages WHERE phone_number = '+447911123456');

INSERT INTO sms_messages (phone_number, direction, content, pipeline_id, ai_intent, match_status, follow_up_status)
SELECT
  '+447822234567',
  'inbound',
  'Thanks but not for me. Good luck',
  (SELECT id FROM pipelines WHERE is_active = true LIMIT 1),
  'negative',
  'unmatched',
  'open'
WHERE NOT EXISTS (SELECT 1 FROM sms_messages WHERE phone_number = '+447822234567');

INSERT INTO sms_messages (phone_number, direction, content, pipeline_id, ai_intent, match_status, follow_up_status)
SELECT
  '+447733345678',
  'inbound',
  'How much does it cost?',
  (SELECT id FROM pipelines WHERE is_active = true LIMIT 1),
  'question',
  'unmatched',
  'open'
WHERE NOT EXISTS (SELECT 1 FROM sms_messages WHERE phone_number = '+447733345678');

INSERT INTO sms_messages (phone_number, direction, content, pipeline_id, ai_intent, match_status, follow_up_status)
SELECT
  '+447644456789',
  'inbound',
  'Yes definitely interested. My son plays for Chelsea academy u16. Call me please',
  (SELECT id FROM pipelines WHERE is_active = true LIMIT 1),
  'positive',
  'unmatched',
  'open'
WHERE NOT EXISTS (SELECT 1 FROM sms_messages WHERE phone_number = '+447644456789');

INSERT INTO sms_messages (phone_number, direction, content, pipeline_id, ai_intent, match_status, follow_up_status)
SELECT
  '+447555567890',
  'inbound',
  'Received thanks. Will discuss with my parents and get back to you',
  (SELECT id FROM pipelines WHERE is_active = true LIMIT 1),
  'neutral',
  'unmatched',
  'open'
WHERE NOT EXISTS (SELECT 1 FROM sms_messages WHERE phone_number = '+447555567890');

-- SMS without pipeline (generic)
INSERT INTO sms_messages (phone_number, direction, content, ai_intent, match_status, follow_up_status)
SELECT
  '+447466678901',
  'inbound',
  'Who is this?',
  'neutral',
  'unmatched',
  'open'
WHERE NOT EXISTS (SELECT 1 FROM sms_messages WHERE phone_number = '+447466678901');
