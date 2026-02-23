-- Fix automation_logs.step_id FK to allow step deletion during automation updates
-- Change from RESTRICT to SET NULL so historical logs are preserved
ALTER TABLE automation_logs ALTER COLUMN step_id DROP NOT NULL;
ALTER TABLE automation_logs DROP CONSTRAINT IF EXISTS automation_logs_step_id_fkey;
ALTER TABLE automation_logs ADD CONSTRAINT automation_logs_step_id_fkey
  FOREIGN KEY (step_id) REFERENCES automation_steps(id) ON DELETE SET NULL;
