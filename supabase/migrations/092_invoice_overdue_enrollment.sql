-- Migration: enrol deals into 'invoice_overdue' automations when an invoice
-- transitions to status='overdue'.
--
-- The cron in app/api/cron/check-time-triggers flips invoices to 'overdue'
-- once their due_date passes, and this trigger turns that status flip into
-- automation enrollments — same pattern as on_deal_stage_change in 017,
-- just keyed off invoice status instead of deal stage.
--
-- Idempotent: skips deals already actively enrolled in the automation, so
-- a stuck invoice (re-flipped to overdue) does not double-enroll.

CREATE OR REPLACE FUNCTION enroll_deal_on_invoice_overdue()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  automation        RECORD;
  first_step        RECORD;
  enrollment_exists BOOLEAN;
  next_step_time    TIMESTAMPTZ;
  deal_pipeline_id  UUID;
BEGIN
  -- We only act on the transition INTO 'overdue'.
  IF NEW.status IS DISTINCT FROM 'overdue' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'overdue' THEN
    RETURN NEW;
  END IF;
  IF NEW.deal_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pipeline_id INTO deal_pipeline_id FROM deals WHERE id = NEW.deal_id;

  FOR automation IN
    SELECT a.id, a.config
    FROM automations a
    WHERE a.trigger_type = 'invoice_overdue'
      AND a.is_active = true
      AND (a.pipeline_id IS NULL OR a.pipeline_id = deal_pipeline_id)
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM automation_enrollments ae
      WHERE ae.automation_id = automation.id
        AND ae.deal_id = NEW.deal_id
        AND ae.status IN ('active', 'paused')
    ) INTO enrollment_exists;

    IF enrollment_exists THEN
      CONTINUE;
    END IF;

    SELECT * INTO first_step
    FROM automation_steps
    WHERE automation_id = automation.id
    ORDER BY step_order ASC
    LIMIT 1;

    IF first_step IS NULL THEN
      CONTINUE;
    END IF;

    -- Wait steps schedule for the future, all other types fire immediately.
    IF first_step.step_type = 'wait' THEN
      next_step_time := NOW()
        + ((COALESCE(first_step.delay_days, 0) * INTERVAL '1 day')
        + (COALESCE(first_step.delay_hours, 0) * INTERVAL '1 hour'));
    ELSE
      next_step_time := NOW();
    END IF;

    INSERT INTO automation_enrollments (
      automation_id, deal_id, status, current_step_id, next_step_at, enrolled_at
    ) VALUES (
      automation.id, NEW.deal_id, 'active', first_step.id, next_step_time, NOW()
    );

    RAISE NOTICE 'Auto-enrolled deal % in invoice_overdue automation %', NEW.deal_id, automation.id;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_invoice_overdue ON invoices;
CREATE TRIGGER on_invoice_overdue
AFTER INSERT OR UPDATE OF status ON invoices
FOR EACH ROW
WHEN (NEW.status = 'overdue')
EXECUTE FUNCTION enroll_deal_on_invoice_overdue();

-- Speeds up the cron's "find invoices to flip" query.
CREATE INDEX IF NOT EXISTS idx_invoices_due_status
  ON invoices(due_date, status)
  WHERE status IN ('sent', 'viewed');
