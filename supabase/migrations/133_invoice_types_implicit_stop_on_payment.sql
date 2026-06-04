-- Tighten the on_invoice_paid trigger from migration 132: an automation
-- of type invoice_generation or deposit_invoice should ALWAYS stop when
-- its invoice is paid, even if the config didn't set stop_on_payment
-- explicitly. The previous version only honoured the explicit flag,
-- which left existing automations created before stop_on_payment became
-- a default still hanging in 'active' after the contact paid.

CREATE OR REPLACE FUNCTION stop_enrollments_on_invoice_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_enrollment RECORD;
  v_automation RECORD;
  v_paid_stage_id UUID;
  v_should_stop BOOLEAN;
BEGIN
  IF NEW.status IS DISTINCT FROM 'paid' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'paid' THEN
    RETURN NEW;
  END IF;
  IF NEW.deal_id IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_enrollment IN (
    SELECT ae.id, ae.automation_id
    FROM automation_enrollments ae
    WHERE ae.deal_id = NEW.deal_id
      AND ae.status = 'active'
  ) LOOP
    SELECT a.config, a.automation_type INTO v_automation
    FROM automations a
    WHERE a.id = v_enrollment.automation_id;

    -- Stop semantically when the automation type is an invoice flow
    -- (always relevant to payments) OR the automation has explicitly
    -- opted in via config.stop_on_payment. Other types (initial_contact,
    -- stage_reminder, etc.) keep running unless the user opts in.
    v_should_stop :=
      v_automation.automation_type IN ('invoice_generation', 'deposit_invoice')
      OR (v_automation.config->>'stop_on_payment')::boolean IS TRUE;

    IF NOT v_should_stop THEN
      CONTINUE;
    END IF;

    UPDATE automation_enrollments
    SET status         = 'completed',
        completed_at   = NOW(),
        stopped_reason = 'Invoice paid',
        next_step_at   = NULL
    WHERE id = v_enrollment.id;

    v_paid_stage_id := NULLIF(v_automation.config->>'paid_stage_id', '')::UUID;
    IF v_paid_stage_id IS NOT NULL THEN
      UPDATE deals
      SET current_stage_id  = v_paid_stage_id,
          stage_changed_at  = NOW()
      WHERE id = NEW.deal_id
        AND current_stage_id IS DISTINCT FROM v_paid_stage_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Re-run backfill with the looser rule so the existing stuck enrollment
-- on Muhammad Abubakar's Summer Residency invoice gets cleaned up.
UPDATE automation_enrollments ae
SET status = 'completed',
    completed_at = NOW(),
    stopped_reason = 'Invoice paid (backfill)',
    next_step_at = NULL
FROM automations a, invoices i
WHERE ae.automation_id = a.id
  AND ae.deal_id = i.deal_id
  AND ae.status = 'active'
  AND i.status = 'paid'
  AND (
    a.automation_type IN ('invoice_generation', 'deposit_invoice')
    OR (a.config->>'stop_on_payment')::boolean IS TRUE
  );
