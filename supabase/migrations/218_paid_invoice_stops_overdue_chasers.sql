-- QA-23 / QA-24: paying an invoice must stop the overdue chasers, the same way
-- cancelling it already does.
--
-- stop_enrollments_on_invoice_paid() stops an enrolment when either
--
--   a) the automation type is an invoice flow
--      ('invoice_generation', 'deposit_invoice'), or
--   b) the automation opted in with config.stop_on_payment
--
-- 'payment_overdue' satisfies NEITHER. It is missing from the type list, and
-- the Payment Overdue Escalation template does not expose a stop_on_payment
-- control at all (lib/types/automations.ts — its `configurable` block has no
-- such key), so the flag is absent on every row of that type and can never
-- become true. The live "QA Past Due Reminder" has it null.
--
-- So the one automation whose entire job is chasing an unpaid invoice was the
-- one the paid trigger ignored. In practice the chasing does stop, because
-- every route that marks an invoice paid — the Stripe webhook and both manual
-- Mark Paid paths — calls applyPaymentToDeal() in lib/payments/payment-received.ts,
-- which ends every active enrolment on the deal. This trigger is the backstop
-- for anything that writes invoices.status directly (a migration, a fix-up
-- script, the SQL editor), and the backstop had a hole exactly where it
-- mattered most: a player who had paid kept getting "your payment is overdue"
-- emails for money already sent.
--
-- migration 200 already includes 'payment_overdue' in the CANCELLED mirror, so
-- this also removes an asymmetry between the two triggers that would bite
-- whichever one was read next.
--
-- Only the type list changes; the paid_stage_id move and the 'Invoice paid'
-- reason are untouched. Idempotent.

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
    --
    -- 'payment_overdue' belongs in this list for the same reason as the
    -- other two: it exists only to chase an invoice, so the invoice being
    -- paid is the end of its job. It cannot opt in via config — its
    -- template has no stop_on_payment control.
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
      SET current_stage_id  = v_paid_stage_id,
          stage_changed_at  = NOW()
      WHERE id = NEW.deal_id
        AND current_stage_id IS DISTINCT FROM v_paid_stage_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
