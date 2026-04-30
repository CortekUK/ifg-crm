-- Migration: enrol deals into 'invoice_created' automations when an invoice
-- transitions to status='sent'.
--
-- Mirrors migration 092 (on_invoice_overdue) — same shape, fires on the
-- 'sent' status flip instead of 'overdue'. This is the trigger the
-- deposit_invoice automation type now uses, so the sequence only fires for
-- deals with a real, sent invoice (not just stage movement).
--
-- Idempotent: skips deals already actively enrolled in the automation, so
-- a re-sent invoice (or status churn) does not double-enroll.

CREATE OR REPLACE FUNCTION enroll_deal_on_invoice_sent()
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
  IF NEW.status IS DISTINCT FROM 'sent' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'sent' THEN
    RETURN NEW;
  END IF;
  IF NEW.deal_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pipeline_id INTO deal_pipeline_id FROM deals WHERE id = NEW.deal_id;

  FOR automation IN
    SELECT a.id
    FROM automations a
    WHERE a.trigger_type = 'invoice_created'
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
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_invoice_sent ON invoices;
CREATE TRIGGER on_invoice_sent
AFTER INSERT OR UPDATE OF status ON invoices
FOR EACH ROW
WHEN (NEW.status = 'sent')
EXECUTE FUNCTION enroll_deal_on_invoice_sent();
