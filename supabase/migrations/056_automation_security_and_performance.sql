-- Migration 056: Automation Security & Performance Fixes
-- 1. Revoke anon access from debug functions (Bug 4)
-- 2. Add composite index for queue processing (Bug 11)
-- 3. Fix invoke_process_automations auth header (Bug 5)
-- 4. Add 'pending' to automation_logs status constraint (Bug 2)

-- ============================================
-- 1. REVOKE ANON ACCESS FROM DEBUG FUNCTIONS
-- ============================================
-- These functions expose automation internals (names, steps, template IDs,
-- enrollment statuses, deal titles) to unauthenticated API callers.

REVOKE EXECUTE ON FUNCTION check_enrollment_status(text) FROM anon;
REVOKE EXECUTE ON FUNCTION check_automation_steps(text) FROM anon;

-- Also revoke from debug_automation_matching and manually_enroll_deal_in_automation
DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION debug_automation_matching() FROM anon;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'debug_automation_matching not granted to anon or does not exist';
END $$;

DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION manually_enroll_deal_in_automation(uuid, uuid) FROM anon;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'manually_enroll_deal_in_automation not granted to anon or does not exist';
END $$;

-- ============================================
-- 2. ADD COMPOSITE INDEX FOR QUEUE PROCESSING
-- ============================================
-- The processQueue query filters on status='active' AND next_step_at <= now().
-- Without a composite index this does a full table scan as enrollments grow.

CREATE INDEX IF NOT EXISTS idx_enrollments_active_next_step
  ON automation_enrollments (status, next_step_at)
  WHERE status = 'active';

-- ============================================
-- 3. FIX invoke_process_automations AUTH HEADER
-- ============================================
-- The function was missing the Authorization header, so manual invocation
-- via SELECT invoke_process_automations() would fail since the edge function requires auth.

CREATE OR REPLACE FUNCTION invoke_process_automations()
RETURNS jsonb AS $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
  response jsonb;
BEGIN
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);

  IF supabase_url IS NULL THEN
    supabase_url := 'https://jiuxsintslqryrvgevmc.supabase.co';
  END IF;

  IF service_key IS NULL THEN
    RAISE EXCEPTION 'app.settings.service_role_key is not configured';
  END IF;

  -- Make HTTP request to the Edge Function with auth header
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/process-automations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb
  ) INTO response;

  RETURN response;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION invoke_process_automations() IS
'Manually invoke the process-automations Edge Function.
Includes Authorization header for proper authentication.
Requires app.settings.service_role_key to be configured.
Example: SELECT invoke_process_automations();';

-- ============================================
-- 4. ADD 'pending' TO AUTOMATION_LOGS STATUS CONSTRAINT
-- ============================================
-- The process-automations function now inserts logs as 'pending' before sending
-- and updates to 'sent' after success. The existing CHECK constraint only allows
-- 'sent', 'failed', 'skipped'.

ALTER TABLE automation_logs DROP CONSTRAINT IF EXISTS automation_logs_status_check;
ALTER TABLE automation_logs ADD CONSTRAINT automation_logs_status_check
  CHECK (status IN ('pending', 'sent', 'failed', 'skipped'));
