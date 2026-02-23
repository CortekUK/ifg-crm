-- Fix automation_enrollments.current_step_id FK to allow step deletion during automation updates
ALTER TABLE automation_enrollments DROP CONSTRAINT IF EXISTS automation_enrollments_current_step_id_fkey;
ALTER TABLE automation_enrollments ADD CONSTRAINT automation_enrollments_current_step_id_fkey
  FOREIGN KEY (current_step_id) REFERENCES automation_steps(id) ON DELETE SET NULL;
