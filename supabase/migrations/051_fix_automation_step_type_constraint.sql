-- Fix step_type CHECK constraint to include 'create_deal'
ALTER TABLE automation_steps DROP CONSTRAINT IF EXISTS automation_steps_step_type_check;
ALTER TABLE automation_steps ADD CONSTRAINT automation_steps_step_type_check
  CHECK (step_type IN ('send_email', 'wait', 'send_sms', 'move_to_stage', 'create_deal'));
