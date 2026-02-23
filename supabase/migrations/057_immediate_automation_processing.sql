-- Migration 057: Immediate automation processing on enrollment
-- Instead of waiting up to 5 minutes for the cron job, invoke
-- process-automations immediately when a new enrollment is created.
-- The cron job remains as a safety net for retries and delayed steps.

-- ============================================
-- TRIGGER: Call process-automations edge function on new enrollment
-- ============================================
CREATE OR REPLACE FUNCTION notify_process_automations()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Only fire for new active enrollments that are ready now
  IF NEW.status = 'active' AND NEW.next_step_at <= NOW() + INTERVAL '1 minute' THEN
    supabase_url := current_setting('app.settings.supabase_url', true);
    service_key := current_setting('app.settings.service_role_key', true);

    IF supabase_url IS NOT NULL AND service_key IS NOT NULL THEN
      -- Fire-and-forget HTTP call to process-automations
      PERFORM net.http_post(
        url := supabase_url || '/functions/v1/process-automations',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := '{}'::jsonb
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fire after insert (new enrollment) or update (re-enrollment from stopped/completed)
DROP TRIGGER IF EXISTS on_enrollment_process ON automation_enrollments;

CREATE TRIGGER on_enrollment_process
  AFTER INSERT OR UPDATE OF status ON automation_enrollments
  FOR EACH ROW
  WHEN (NEW.status = 'active')
  EXECUTE FUNCTION notify_process_automations();

COMMENT ON FUNCTION notify_process_automations() IS
'Immediately invokes the process-automations edge function when a new
enrollment is created or re-activated, so emails go out within seconds
instead of waiting for the 5-minute cron job.';
