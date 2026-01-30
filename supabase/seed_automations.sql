-- Test automations for the IFG CRM
-- Run this in the Supabase SQL Editor AFTER running seed_templates.sql
-- This creates 2 automation workflows with steps

DO $$
DECLARE
  uclan_pipeline_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  salford_pipeline_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  
  -- UCLan stages
  uclan_initial_lead_stage_id uuid;
  uclan_in_contact_stage_id uuid;
  uclan_zoom_scheduled_stage_id uuid;
  uclan_follow_up_stage_id uuid;
  
  -- Salford stages
  salford_initial_lead_stage_id uuid;
  salford_zoom_scheduled_stage_id uuid;
  salford_follow_up_stage_id uuid;
  
  -- Template IDs
  template1_id uuid;
  template2_id uuid;
  template3_id uuid;
  template4_id uuid;
  template5_id uuid;
  
  -- Automation IDs
  automation1_id uuid;
  automation2_id uuid;
  automation3_id uuid;
BEGIN
  -- Get UCLan stage IDs
  SELECT id INTO uclan_initial_lead_stage_id FROM pipeline_stages WHERE pipeline_id = uclan_pipeline_id AND name = 'Initial Lead';
  SELECT id INTO uclan_in_contact_stage_id FROM pipeline_stages WHERE pipeline_id = uclan_pipeline_id AND name = 'In Contact';
  SELECT id INTO uclan_zoom_scheduled_stage_id FROM pipeline_stages WHERE pipeline_id = uclan_pipeline_id AND name = 'Zoom Scheduled';
  SELECT id INTO uclan_follow_up_stage_id FROM pipeline_stages WHERE pipeline_id = uclan_pipeline_id AND name = 'Follow Up';
  
  -- Get Salford stage IDs
  SELECT id INTO salford_initial_lead_stage_id FROM pipeline_stages WHERE pipeline_id = salford_pipeline_id AND name = 'Initial Lead';
  SELECT id INTO salford_zoom_scheduled_stage_id FROM pipeline_stages WHERE pipeline_id = salford_pipeline_id AND name = 'Zoom Scheduled';
  SELECT id INTO salford_follow_up_stage_id FROM pipeline_stages WHERE pipeline_id = salford_pipeline_id AND name = 'Follow Up';
  
  -- Get template IDs (must run seed_templates.sql first!)
  SELECT id INTO template1_id FROM email_templates WHERE name = 'Initial Contact Email 1';
  SELECT id INTO template2_id FROM email_templates WHERE name = 'Initial Contact Email 2';
  SELECT id INTO template3_id FROM email_templates WHERE name = 'Initial Contact Email 3';
  SELECT id INTO template4_id FROM email_templates WHERE name = 'Follow Up Email 1';
  SELECT id INTO template5_id FROM email_templates WHERE name = 'Follow Up Email 2';
  
  -- Check if templates exist
  IF template1_id IS NULL THEN
    RAISE EXCEPTION 'Templates not found. Please run seed_templates.sql first!';
  END IF;
  
  -- Clear existing test automations
  DELETE FROM automation_steps WHERE automation_id IN (
    SELECT id FROM automations WHERE name IN (
      'UCLan Initial Contact Sequence',
      'UCLan Follow Up Sequence',
      'Salford Initial Contact Sequence'
    )
  );
  DELETE FROM automations WHERE name IN (
    'UCLan Initial Contact Sequence',
    'UCLan Follow Up Sequence',
    'Salford Initial Contact Sequence'
  );
  
  -- =============================================
  -- AUTOMATION 1: UCLan Initial Contact Sequence
  -- =============================================
  INSERT INTO automations (id, name, description, pipeline_id, trigger_stage_id, stop_on_stage_ids, is_active)
  VALUES (
    gen_random_uuid(),
    'UCLan Initial Contact Sequence',
    '3-step email sequence over 8 days',
    uclan_pipeline_id,
    uclan_initial_lead_stage_id,
    ARRAY[uclan_zoom_scheduled_stage_id, uclan_follow_up_stage_id, uclan_in_contact_stage_id],
    true
  )
  RETURNING id INTO automation1_id;
  
  -- Add steps for UCLan Initial Contact automation
  INSERT INTO automation_steps (automation_id, step_order, step_type, delay_days, delay_hours, email_template_id) VALUES
    (automation1_id, 1, 'send_email', 0, 0, template1_id),
    (automation1_id, 2, 'wait', 3, 0, NULL),
    (automation1_id, 3, 'send_email', 0, 0, template2_id),
    (automation1_id, 4, 'wait', 5, 0, NULL),
    (automation1_id, 5, 'send_email', 0, 0, template3_id);
  
  RAISE NOTICE 'Created automation: UCLan Initial Contact Sequence with 5 steps';
  
  -- =============================================
  -- AUTOMATION 2: UCLan Follow Up Sequence
  -- =============================================
  INSERT INTO automations (id, name, description, pipeline_id, trigger_stage_id, stop_on_stage_ids, is_active)
  VALUES (
    gen_random_uuid(),
    'UCLan Follow Up Sequence',
    '2-step follow-up sequence over 6 days',
    uclan_pipeline_id,
    uclan_follow_up_stage_id,
    ARRAY[uclan_zoom_scheduled_stage_id],
    true
  )
  RETURNING id INTO automation2_id;
  
  -- Add steps for UCLan Follow Up automation
  INSERT INTO automation_steps (automation_id, step_order, step_type, delay_days, delay_hours, email_template_id) VALUES
    (automation2_id, 1, 'send_email', 0, 0, template4_id),
    (automation2_id, 2, 'wait', 3, 0, NULL),
    (automation2_id, 3, 'send_email', 0, 0, template5_id),
    (automation2_id, 4, 'wait', 3, 0, NULL),
    (automation2_id, 5, 'send_email', 0, 0, template4_id);
  
  RAISE NOTICE 'Created automation: UCLan Follow Up Sequence with 5 steps';
  
  -- =============================================
  -- AUTOMATION 3: Salford Initial Contact Sequence
  -- =============================================
  INSERT INTO automations (id, name, description, pipeline_id, trigger_stage_id, stop_on_stage_ids, is_active)
  VALUES (
    gen_random_uuid(),
    'Salford Initial Contact Sequence',
    '3-step email sequence over 8 days',
    salford_pipeline_id,
    salford_initial_lead_stage_id,
    ARRAY[salford_zoom_scheduled_stage_id, salford_follow_up_stage_id],
    false  -- This one is paused
  )
  RETURNING id INTO automation3_id;
  
  -- Add steps for Salford Initial Contact automation
  INSERT INTO automation_steps (automation_id, step_order, step_type, delay_days, delay_hours, email_template_id) VALUES
    (automation3_id, 1, 'send_email', 0, 0, template1_id),
    (automation3_id, 2, 'wait', 3, 0, NULL),
    (automation3_id, 3, 'send_email', 0, 0, template2_id),
    (automation3_id, 4, 'wait', 5, 0, NULL),
    (automation3_id, 5, 'send_email', 0, 0, template3_id);
  
  RAISE NOTICE 'Created automation: Salford Initial Contact Sequence with 5 steps (PAUSED)';
  
  RAISE NOTICE 'Successfully created 3 test automations with a total of 15 steps';
END $$;

-- Verify the automations were created
SELECT 
  a.name,
  a.description,
  p.name AS pipeline,
  ps.name AS trigger_stage,
  a.is_active,
  COUNT(s.id) AS step_count
FROM automations a
LEFT JOIN pipelines p ON a.pipeline_id = p.id
LEFT JOIN pipeline_stages ps ON a.trigger_stage_id = ps.id
LEFT JOIN automation_steps s ON a.id = s.automation_id
GROUP BY a.id, a.name, a.description, p.name, ps.name, a.is_active
ORDER BY a.created_at DESC;
