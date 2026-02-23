-- Fix enrollments stuck with current_step_id = NULL
-- These were caused by ON DELETE SET NULL when automation steps were deleted and recreated
-- Reset them to the first step of their automation

UPDATE automation_enrollments ae
SET
  current_step_id = (
    SELECT s.id
    FROM automation_steps s
    WHERE s.automation_id = ae.automation_id
    ORDER BY s.step_order ASC
    LIMIT 1
  ),
  next_step_at = NOW()
WHERE ae.status = 'active'
  AND ae.current_step_id IS NULL
  AND EXISTS (
    SELECT 1 FROM automation_steps s
    WHERE s.automation_id = ae.automation_id
  );

-- Stop enrollments that have no steps at all (automation was emptied)
UPDATE automation_enrollments ae
SET
  status = 'stopped',
  stopped_reason = 'Automation has no steps',
  next_step_at = NULL
WHERE ae.status = 'active'
  AND ae.current_step_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM automation_steps s
    WHERE s.automation_id = ae.automation_id
  );
