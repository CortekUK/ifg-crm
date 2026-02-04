-- Fix: Drop faulty updated_at trigger on automation_enrollments
-- The table doesn't have an updated_at column but has a trigger trying to update it

DROP TRIGGER IF EXISTS update_automation_enrollments_updated_at ON automation_enrollments;
