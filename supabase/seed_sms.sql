-- Test SMS messages for the IFG CRM
-- Run this in the Supabase SQL Editor AFTER running seed_contacts.sql
-- This creates sample inbound SMS messages with various statuses and AI intents

DO $$
DECLARE
  uclan_pipeline_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  salford_pipeline_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  john_id uuid;
  emma_id uuid;
  profile_id uuid;
BEGIN
  -- Get the first profile (your logged-in user)
  SELECT id INTO profile_id FROM profiles LIMIT 1;
  
  -- Get some contact IDs (for matched messages)
  SELECT id INTO john_id FROM contacts WHERE email = 'john.smith@example.com';
  SELECT id INTO emma_id FROM contacts WHERE email = 'emma.wilson@example.com';
  
  -- Clear existing test SMS messages
  DELETE FROM sms_messages WHERE phone_number LIKE '+1415555%' OR phone_number LIKE '+1234567%';
  
  -- Insert test SMS messages
  INSERT INTO sms_messages (
    phone_number, 
    content, 
    direction, 
    contact_id, 
    pipeline_id, 
    ai_intent, 
    ai_intent_confidence, 
    match_status,
    matched_by_id,
    matched_at,
    created_at
  ) VALUES
    -- UNMATCHED MESSAGES (4)
    (
      '+14155551234',
      'Hi, I''m interested in the UCLan programme. Can you tell me more about the costs and accommodation?',
      'inbound',
      NULL,
      uclan_pipeline_id,
      'positive',
      0.92,
      'unmatched',
      NULL,
      NULL,
      NOW() - INTERVAL '2 hours'
    ),
    (
      '+14155555678',
      'Please remove me from your list. I am no longer interested.',
      'inbound',
      NULL,
      uclan_pipeline_id,
      'negative',
      0.88,
      'unmatched',
      NULL,
      NULL,
      NOW() - INTERVAL '5 hours'
    ),
    (
      '+14155559012',
      'What are the total costs involved for the full year? Also interested in scholarship options.',
      'inbound',
      NULL,
      uclan_pipeline_id,
      'positive',
      0.75,
      'unmatched',
      NULL,
      NULL,
      NOW() - INTERVAL '1 day'
    ),
    (
      '+14155553456',
      'Not interested thanks, please stop texting me',
      'inbound',
      NULL,
      salford_pipeline_id,
      'negative',
      0.95,
      'unmatched',
      NULL,
      NULL,
      NOW() - INTERVAL '3 hours'
    ),
    (
      '+14155557890',
      'Ok',
      'inbound',
      NULL,
      uclan_pipeline_id,
      'neutral',
      0.55,
      'unmatched',
      NULL,
      NULL,
      NOW() - INTERVAL '30 minutes'
    ),
    
    -- AUTO-MATCHED MESSAGES (2) - these have contact_id set
    (
      '+1234567890',
      'Yes I would like to schedule a call! What times work for you this week?',
      'inbound',
      john_id,
      uclan_pipeline_id,
      'positive',
      0.98,
      'auto_matched',
      NULL,
      NULL,
      NOW() - INTERVAL '1 hour'
    ),
    (
      '+1234567891',
      'Thanks for the info, I''ll discuss with my parents and get back to you next week',
      'inbound',
      emma_id,
      uclan_pipeline_id,
      'neutral',
      0.65,
      'auto_matched',
      NULL,
      NULL,
      NOW() - INTERVAL '4 hours'
    ),
    
    -- MANUALLY MATCHED MESSAGE (1)
    (
      '+14155554321',
      'Hi this is Emma, I got a new phone number. Still interested in the Salford programme!',
      'inbound',
      emma_id,
      salford_pipeline_id,
      'positive',
      0.85,
      'manually_matched',
      profile_id,
      NOW() - INTERVAL '2 hours',
      NOW() - INTERVAL '6 hours'
    ),
    
    -- SPAM MESSAGES (2)
    (
      '+14155550000',
      'FREE PRIZE WINNER CLICK HERE www.spam-link.com',
      'inbound',
      NULL,
      uclan_pipeline_id,
      'negative',
      0.99,
      'spam',
      profile_id,
      NOW() - INTERVAL '5 hours',
      NOW() - INTERVAL '8 hours'
    ),
    (
      '+14155550001',
      'Congratulations! You have won £1000000. Reply YES to claim.',
      'inbound',
      NULL,
      NULL,
      'unknown',
      0.30,
      'spam',
      profile_id,
      NOW() - INTERVAL '4 hours',
      NOW() - INTERVAL '12 hours'
    );
  
  RAISE NOTICE 'Successfully created 10 test SMS messages';
END $$;

-- Verify the messages were created
SELECT 
  phone_number,
  LEFT(content, 50) || '...' AS content_preview,
  direction,
  ai_intent,
  ai_intent_confidence,
  match_status,
  c.first_name || ' ' || c.last_name AS matched_contact,
  p.name AS pipeline,
  created_at
FROM sms_messages sm
LEFT JOIN contacts c ON sm.contact_id = c.id
LEFT JOIN pipelines p ON sm.pipeline_id = p.id
WHERE sm.direction = 'inbound'
ORDER BY sm.created_at DESC;
