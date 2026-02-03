-- Migration: Setup pg_cron for Automation Processing
-- Schedules the process-automations Edge Function to run every 5 minutes
-- 
-- NOTE: pg_cron requires Supabase Pro plan or self-hosted Postgres.
-- If pg_cron is not available, use Vercel Cron or an external scheduler instead.

-- ============================================
-- ENABLE REQUIRED EXTENSIONS
-- ============================================

-- Enable pg_cron extension (if available)
-- This may fail on Supabase Free tier - that's okay, use external cron instead
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron extension not available - use external cron scheduler instead';
END $$;

-- Enable pg_net extension for HTTP requests (usually already enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================
-- CREATE CRON JOB TO PROCESS AUTOMATIONS
-- ============================================

-- Remove existing job if it exists (to allow re-running migration)
DO $$
BEGIN
  PERFORM cron.unschedule('process-automations-job');
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron not available - skipping unschedule';
  WHEN OTHERS THEN
    -- Job might not exist, that's fine
    NULL;
END $$;

-- Schedule the automation processor to run every 5 minutes
-- Uses pg_net to make an HTTP POST request to the Edge Function
DO $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Get the Supabase URL from app settings or environment
  -- Note: These need to be configured in the database settings
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);
  
  -- If settings are not configured, try to use default Supabase project URL
  IF supabase_url IS NULL THEN
    -- Fall back to getting from vault or use placeholder
    supabase_url := 'https://jiuxsintslqryrvgevmc.supabase.co';
    RAISE NOTICE 'Using default Supabase URL: %', supabase_url;
  END IF;

  -- Schedule the cron job
  PERFORM cron.schedule(
    'process-automations-job',  -- Job name
    '*/5 * * * *',              -- Every 5 minutes
    format(
      $CRON$
      SELECT net.http_post(
        url := '%s/functions/v1/process-automations',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer %s"}'::jsonb,
        body := '{}'::jsonb
      );
      $CRON$,
      supabase_url,
      COALESCE(service_key, 'YOUR_SERVICE_ROLE_KEY')  -- Replace with actual key
    )
  );
  
  RAISE NOTICE 'Scheduled process-automations-job to run every 5 minutes';

EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron not available - please set up an external cron scheduler';
    RAISE NOTICE 'Recommended: Use Vercel Cron with the following configuration:';
    RAISE NOTICE '  Path: /api/cron/process-automations';
    RAISE NOTICE '  Schedule: */5 * * * *';
  WHEN OTHERS THEN
    RAISE NOTICE 'Error setting up cron job: %', SQLERRM;
END $$;

-- ============================================
-- ALTERNATIVE: Database Function for Manual Invocation
-- ============================================
-- This function can be called manually or by external schedulers
-- if pg_cron is not available

CREATE OR REPLACE FUNCTION invoke_process_automations()
RETURNS jsonb AS $$
DECLARE
  supabase_url TEXT;
  response jsonb;
BEGIN
  supabase_url := current_setting('app.settings.supabase_url', true);
  
  IF supabase_url IS NULL THEN
    supabase_url := 'https://jiuxsintslqryrvgevmc.supabase.co';
  END IF;

  -- Make HTTP request to the Edge Function
  -- Note: This uses pg_net which is available on Supabase
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/process-automations',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) INTO response;

  RETURN response;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Allow the cron extension to use net.http_post
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT USAGE ON SCHEMA net TO postgres;

-- ============================================
-- DOCUMENTATION
-- ============================================

COMMENT ON FUNCTION invoke_process_automations() IS 
'Manually invoke the process-automations Edge Function. 
Can be called by external schedulers if pg_cron is not available.
Example: SELECT invoke_process_automations();';
