-- Test deals for UCLan 2026 pipeline
-- Run this in the Supabase SQL Editor after:
-- 1. You have created a user account and logged in (so you have a profile)
-- 2. You have run seed.sql (to create pipelines and stages)
-- 3. You have run seed_contacts.sql (to create test contacts)

DO $$
DECLARE
  profile_id uuid;
  uclan_pipeline_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  initial_lead_stage_id uuid;
  in_contact_stage_id uuid;
  zoom_scheduled_stage_id uuid;
  follow_up_stage_id uuid;
  collecting_docs_stage_id uuid;
  john_id uuid;
  emma_id uuid;
  james_id uuid;
  olivia_id uuid;
  william_id uuid;
  sophia_id uuid;
  benjamin_id uuid;
  lucas_id uuid;
  mia_id uuid;
BEGIN
  -- Get the first profile (your logged-in user)
  SELECT id INTO profile_id FROM profiles LIMIT 1;
  
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'No profile found. Please log in to create a user profile first.';
  END IF;
  
  -- Get stage IDs for UCLan 2026 pipeline
  SELECT id INTO initial_lead_stage_id FROM pipeline_stages 
    WHERE pipeline_id = uclan_pipeline_id AND name = 'Initial Lead';
  SELECT id INTO in_contact_stage_id FROM pipeline_stages 
    WHERE pipeline_id = uclan_pipeline_id AND name = 'In Contact';
  SELECT id INTO zoom_scheduled_stage_id FROM pipeline_stages 
    WHERE pipeline_id = uclan_pipeline_id AND name = 'Zoom Scheduled';
  SELECT id INTO follow_up_stage_id FROM pipeline_stages 
    WHERE pipeline_id = uclan_pipeline_id AND name = 'Follow Up';
  SELECT id INTO collecting_docs_stage_id FROM pipeline_stages 
    WHERE pipeline_id = uclan_pipeline_id AND name = 'Collecting Documents';
  
  IF initial_lead_stage_id IS NULL THEN
    RAISE EXCEPTION 'Pipeline stages not found. Please run seed.sql first.';
  END IF;
  
  -- Get contact IDs
  SELECT id INTO john_id FROM contacts WHERE email = 'john.smith@example.com';
  SELECT id INTO emma_id FROM contacts WHERE email = 'emma.wilson@example.com';
  SELECT id INTO james_id FROM contacts WHERE email = 'james.brown@example.com';
  SELECT id INTO olivia_id FROM contacts WHERE email = 'olivia.jones@example.com';
  SELECT id INTO william_id FROM contacts WHERE email = 'william.davis@example.com';
  SELECT id INTO sophia_id FROM contacts WHERE email = 'sophia.martinez@example.com';
  SELECT id INTO benjamin_id FROM contacts WHERE email = 'benjamin.taylor@example.com';
  SELECT id INTO lucas_id FROM contacts WHERE email = 'lucas.thomas@example.com';
  SELECT id INTO mia_id FROM contacts WHERE email = 'mia.jackson@example.com';
  
  IF john_id IS NULL THEN
    RAISE EXCEPTION 'Contacts not found. Please run seed_contacts.sql first.';
  END IF;
  
  -- Clear existing test deals to avoid duplicates
  DELETE FROM deals WHERE pipeline_id = uclan_pipeline_id;
  
  -- Insert test deals across different stages
  INSERT INTO deals (contact_id, pipeline_id, current_stage_id, deal_owner_id, deal_value, title, source) VALUES
    -- Initial Lead stage (3 deals)
    (john_id, uclan_pipeline_id, initial_lead_stage_id, profile_id, 15000.00, 'John Smith', 'website_form'),
    (emma_id, uclan_pipeline_id, initial_lead_stage_id, profile_id, 15000.00, 'Emma Wilson', 'website_form'),
    (sophia_id, uclan_pipeline_id, initial_lead_stage_id, profile_id, 15000.00, 'Sophia Martinez', 'email_reply'),
    
    -- In Contact stage (2 deals)
    (james_id, uclan_pipeline_id, in_contact_stage_id, profile_id, 14000.00, 'James Brown', 'manual'),
    (benjamin_id, uclan_pipeline_id, in_contact_stage_id, profile_id, 15000.00, 'Benjamin Taylor', 'website_form'),
    
    -- Zoom Scheduled stage (2 deals)
    (olivia_id, uclan_pipeline_id, zoom_scheduled_stage_id, profile_id, 15000.00, 'Olivia Jones', 'sms_reply'),
    (lucas_id, uclan_pipeline_id, zoom_scheduled_stage_id, profile_id, 15000.00, 'Lucas Thomas', 'csv_import'),
    
    -- Follow Up stage (1 deal)
    (william_id, uclan_pipeline_id, follow_up_stage_id, profile_id, 15000.00, 'William Davis', 'csv_import'),
    
    -- Collecting Documents stage (1 deal)
    (mia_id, uclan_pipeline_id, collecting_docs_stage_id, profile_id, 15000.00, 'Mia Jackson', 'website_form');
  
  -- Log activity for each deal
  INSERT INTO deal_activities (deal_id, activity_type, description, performed_by_id)
  SELECT id, 'deal_created', 'Deal created from test data', profile_id
  FROM deals WHERE pipeline_id = uclan_pipeline_id;
  
  RAISE NOTICE 'Successfully created 9 test deals in UCLan 2026 pipeline';
END $$;

-- Verify the deals were created
SELECT 
  d.title,
  ps.name as stage,
  d.deal_value,
  d.created_at
FROM deals d
JOIN pipeline_stages ps ON d.current_stage_id = ps.id
WHERE d.pipeline_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
ORDER BY ps.display_order, d.created_at;
