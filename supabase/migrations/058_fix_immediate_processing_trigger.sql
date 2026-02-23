-- Migration 058: Fix immediate processing trigger with hardcoded credentials
-- app.settings cannot be set on managed Supabase, so we hardcode the values
-- directly in the SECURITY DEFINER function (only accessible by postgres).

CREATE OR REPLACE FUNCTION notify_process_automations()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire for active enrollments that are ready now (or within 1 minute)
  IF NEW.status = 'active' AND NEW.next_step_at <= NOW() + INTERVAL '1 minute' THEN
    -- Fire-and-forget HTTP call to process-automations
    PERFORM net.http_post(
      url := 'https://jiuxsintslqryrvgevmc.supabase.co/functions/v1/process-automations',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppdXhzaW50c2xxcnlydmdldm1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY5MzQ0NSwiZXhwIjoyMDg1MjY5NDQ1fQ.7l8FBdxsc5Pq9P1zmokeFbyGJZgfRIKyPmuvLSq3IRU"}'::jsonb,
      body := '{}'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also fix invoke_process_automations to use hardcoded values
CREATE OR REPLACE FUNCTION invoke_process_automations()
RETURNS jsonb AS $$
DECLARE
  response jsonb;
BEGIN
  SELECT net.http_post(
    url := 'https://jiuxsintslqryrvgevmc.supabase.co/functions/v1/process-automations',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppdXhzaW50c2xxcnlydmdldm1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY5MzQ0NSwiZXhwIjoyMDg1MjY5NDQ1fQ.7l8FBdxsc5Pq9P1zmokeFbyGJZgfRIKyPmuvLSq3IRU"}'::jsonb,
    body := '{}'::jsonb
  ) INTO response;

  RETURN response;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
