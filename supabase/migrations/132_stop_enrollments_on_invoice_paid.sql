-- When an invoice flips to 'paid', stop every active enrollment on the
-- same deal whose automation has stop_on_payment=true — immediately, in
-- the DB, regardless of where the next cron sweep is. Without this, an
-- enrollment parked in a 7-day wait step keeps showing as active for a
-- week even though the contact has already paid; the existing
-- stop-on-payment check in process-automations only runs when a step is
-- actually being processed.
--
-- Mirrors the behaviour the Stripe webhook already has for the deal's
-- stage (auto-move to "Deposit Paid"), but routed via the DB so it also
-- catches manual mark-as-paid and any future non-Stripe payment paths.
--
-- If the automation also has a paid_stage_id, move the deal there too.
-- Idempotent: enrollments already in completed/stopped state are skipped.

CREATE OR REPLACE FUNCTION stop_enrollments_on_invoice_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_enrollment RECORD;
  v_automation RECORD;
  v_paid_stage_id UUID;
BEGIN
  IF NEW.status IS DISTINCT FROM 'paid' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'paid' THEN
    RETURN NEW; -- already paid, no double-fire
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
    -- Pull the automation's config so we know whether to honour
    -- stop_on_payment, and where (if anywhere) to land the deal.
    SELECT a.config INTO v_automation
    FROM automations a
    WHERE a.id = v_enrollment.automation_id;

    IF (v_automation.config->>'stop_on_payment')::boolean IS NOT TRUE THEN
      CONTINUE;
    END IF;

    UPDATE automation_enrollments
    SET status         = 'completed',
        completed_at   = NOW(),
        stopped_reason = 'Invoice paid',
        next_step_at   = NULL
    WHERE id = v_enrollment.id;

    -- Optional stage move. Stripe webhook may have already moved the
    -- deal; updating to the same stage is harmless. Different
    -- destinations would clobber each other — paid_stage_id wins by
    -- virtue of running last, which matches what the cron stop-on-
    -- payment block does in process-automations.
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

DROP TRIGGER IF EXISTS on_invoice_paid_stop_enrollments ON invoices;
CREATE TRIGGER on_invoice_paid_stop_enrollments
AFTER INSERT OR UPDATE OF status ON invoices
FOR EACH ROW
WHEN (NEW.status = 'paid')
EXECUTE FUNCTION stop_enrollments_on_invoice_paid();

-- One-time backfill: any deal that ALREADY has a paid invoice but still
-- has active enrollments on stop_on_payment automations gets cleaned up
-- right now, so the user doesn't have to wait for a future status flip.
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
  AND (a.config->>'stop_on_payment')::boolean IS TRUE;
