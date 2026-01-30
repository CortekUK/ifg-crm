-- Test campaigns
-- Run this in the Supabase SQL Editor after you have created a user account

DO $$
DECLARE
  profile_id uuid;
BEGIN
  -- Get the first profile (your logged-in user)
  SELECT id INTO profile_id FROM profiles LIMIT 1;
  
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'No profile found. Please log in to create a user profile first.';
  END IF;
  
  -- Clear existing test campaigns
  DELETE FROM campaigns WHERE name IN (
    'January 2026 Newsletter',
    'Gap Year Programme Launch', 
    'Summer Camp Reminder',
    'UCLan Open Day Invite',
    'Follow-up SMS Blast',
    'Deadline Reminder',
    'Welcome Email Series'
  );
  
  -- Insert test campaigns
  INSERT INTO campaigns (name, type, status, from_user_id, created_by_id, sent_at, scheduled_at, created_at) VALUES
    ('January 2026 Newsletter', 'email', 'sent', profile_id, profile_id, NOW() - INTERVAL '5 days', NULL, NOW() - INTERVAL '7 days'),
    ('Gap Year Programme Launch', 'email', 'sent', profile_id, profile_id, NOW() - INTERVAL '12 days', NULL, NOW() - INTERVAL '14 days'),
    ('Summer Camp Reminder', 'sms', 'sent', profile_id, profile_id, NOW() - INTERVAL '3 days', NULL, NOW() - INTERVAL '4 days'),
    ('UCLan Open Day Invite', 'email', 'scheduled', profile_id, profile_id, NULL, NOW() + INTERVAL '7 days', NOW() - INTERVAL '1 day'),
    ('Follow-up SMS Blast', 'sms', 'draft', profile_id, profile_id, NULL, NULL, NOW() - INTERVAL '2 hours'),
    ('Deadline Reminder', 'email', 'draft', profile_id, profile_id, NULL, NULL, NOW() - INTERVAL '1 hour'),
    ('Welcome Email Series', 'email', 'sending', profile_id, profile_id, NULL, NULL, NOW() - INTERVAL '30 minutes');
  
  RAISE NOTICE 'Successfully created 7 test campaigns';
END $$;

-- Verify the campaigns were created
SELECT 
  name,
  type,
  status,
  sent_at,
  scheduled_at,
  created_at
FROM campaigns
ORDER BY created_at DESC;
