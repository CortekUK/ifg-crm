-- QA-08 / QA-23 Bug 2 (Critical): paying an automation-raised invoice recorded
-- NOTHING in the CRM.
--
-- stop_enrollments_on_invoice_paid() moves the deal to the automation's
-- paid_stage_id and stamps "when the stage changed". It stamps a column that
-- does not exist:
--
--   ERROR: 42703: column "stage_changed_at" of relation "deals" does not exist
--   PL/pgSQL function stop_enrollments_on_invoice_paid() line 54
--
-- The column is `stage_entered_at`. Exactly the failure mode of migration 209:
-- a plpgsql body is only PARSED at CREATE time, never planned, so the bad
-- reference applies cleanly and raises the first time the statement actually
-- runs. It has been latent in this function since migration 132.
--
-- The trigger fires on invoices.status -> 'paid', so the exception aborts the
-- UPDATE that fired it and the whole transaction with it. The Stripe webhook's
-- "mark the invoice paid" write therefore fails, and since 8 Oct it correctly
-- returns 500 rather than carrying on — which is why Stripe shows
-- "pending webhooks: 1" and absolutely nothing is recorded: no paid status, no
-- payments row, no deal move, no notification. The player has paid £2,000 and
-- the CRM still shows them owing it (IFG-2026-00171, 9 Oct).
--
-- Why it hid for so long: the branch only runs when the automation has a
-- paid_stage_id AND the deal is not already in that stage. Website deposits
-- have no invoice_generation enrolment to supply one, and a Payment Overdue
-- automation has no paid_stage_id at all — so the two paths that were tested
-- both skipped the broken line.
--
-- Only the column name changes. Idempotent.

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

    -- Invoice flows always stop on payment; anything else must opt in.
    -- 'payment_overdue' is in the list because chasing an invoice is its only
    -- job and its template exposes no stop_on_payment control (migration 218).
    v_should_stop :=
      v_automation.automation_type IN ('invoice_generation', 'deposit_invoice', 'payment_overdue')
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
      SET current_stage_id = v_paid_stage_id,
          stage_entered_at = NOW()
      WHERE id = NEW.deal_id
        AND current_stage_id IS DISTINCT FROM v_paid_stage_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
