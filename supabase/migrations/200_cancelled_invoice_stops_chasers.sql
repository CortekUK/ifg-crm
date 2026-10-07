-- QA-24: a cancelled invoice must stop chasing the player, and a Payment
-- Overdue automation must be able to start at all.
--
-- ── Bug 2: voiding an invoice did not stop the overdue emails ────────────────
--
-- Invoice IFG-2026-00133 was voided after the player had already had the first
-- overdue email. The enrolment stayed active with the second email scheduled
-- for the next day, so somebody whose invoice was cancelled — raised by
-- mistake, or the deal fell through — kept being chased for money they no
-- longer owed.
--
-- `on_invoice_paid_stop_enrollments` already does this for payment. Cancelling
-- had no equivalent, so this adds the mirror. It deliberately does NOT move the
-- deal anywhere: a cancellation is not an outcome, unlike a payment, and
-- guessing a destination stage would move cards nobody asked to move.
--
-- Scoped to the automation types that chase money for an invoice. An
-- initial-contact or welcome sequence running on the same deal is unrelated to
-- the invoice and keeps going.

CREATE OR REPLACE FUNCTION stop_enrollments_on_invoice_cancelled()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_enrollment RECORD;
  v_type TEXT;
BEGIN
  IF NEW.deal_id IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_enrollment IN (
    SELECT ae.id, ae.automation_id
    FROM automation_enrollments ae
    WHERE ae.deal_id = NEW.deal_id
      AND ae.status = 'active'
  ) LOOP
    SELECT a.automation_type INTO v_type
    FROM automations a
    WHERE a.id = v_enrollment.automation_id;

    IF v_type NOT IN ('invoice_generation', 'deposit_invoice', 'payment_overdue') THEN
      CONTINUE;
    END IF;

    -- 'Manual:' prefix for the same reason as the other stop paths — migration
    -- 091 ignores those, so ending the enrolment here does not drag the deal
    -- off to the automation's no-reply or exit stage.
    UPDATE automation_enrollments
    SET status         = 'stopped',
        stopped_reason = 'Manual: invoice cancelled — chasing stopped',
        next_step_at   = NULL
    WHERE id = v_enrollment.id;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_invoice_cancelled_stop_enrollments ON invoices;
CREATE TRIGGER on_invoice_cancelled_stop_enrollments
  AFTER UPDATE OF status ON invoices
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
  EXECUTE FUNCTION stop_enrollments_on_invoice_cancelled();

-- ── Bug 1: a Payment Overdue automation could never be started ───────────────
--
-- "QA Past Due Reminder" was stored with trigger_type 'enters_stage' and no
-- stage. The daily overdue check only looks at automations triggered by
-- 'invoice_overdue', so it was skipped; with no stage it could not start from
-- a stage either. It could never chase anything.
--
-- The code that saves this was fixed on 7 Oct (b2258b0, triggerTypeForAutomationType
-- reads the trigger from the template) — this repairs the row that predates it.
--
-- Deliberately narrow: only payment_overdue, which has exactly one correct
-- trigger. The six live follow_up automations are ALSO stored on 'enters_stage'
-- where their template says 'stage_change', but they are active, they work, and
-- QA has signed off their behaviour — changing the trigger semantics of six
-- live sequences mid-season is not a data fix, it needs a retest. Flagged
-- rather than touched.
UPDATE automations
SET trigger_type = 'invoice_overdue'
WHERE automation_type = 'payment_overdue'
  AND trigger_type IS DISTINCT FROM 'invoice_overdue';
