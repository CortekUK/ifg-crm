-- QA-23: paying an invoice sent a wrong "Deal moved to Follow Up" alert, and
-- walked the deal through the unpaid stage on its way to Deposit Paid.
--
-- Two database rules disagreeing about what "completed" means:
--
--   stop_enrollments_on_invoice_paid  closes the reminder enrolment with
--                                     status = 'completed', reason 'Invoice paid'
--   move_deal_on_enrollment_exit      reads status = 'completed' as "all the
--                                     reminders went out and nobody paid", so it
--                                     moves the deal to the automation's
--                                     no-reply / unpaid stage
--
-- So on payment the deal was moved to the unpaid stage (Follow Up) and only
-- then on to Deposit Paid. QA saw six staff get "Deal moved to Follow Up —
-- Hamza QA 40" at the moment of payment. It is also now visible in the deal's
-- history, since migration 235 started recording system moves.
--
-- Only automations with Goal 2 ("reminders finished, still unpaid") set are
-- affected, which today is none of the live ones — but anyone configuring it
-- would get this.
--
-- Fixed at BOTH ends on purpose. Changing only the writer leaves the same trap
-- for the next thing that closes an enrolment as 'completed' on payment;
-- changing only the reader leaves 'completed' meaning two different things.
--
--   1. the writer now says 'stopped', which is what every other
--      "something ended this early" path already says (a cancelled invoice, a
--      stage move, a reply) and which move_deal_on_enrollment_exit already
--      handles correctly: 'Invoice paid' contains no "repl", so it falls to the
--      "says nothing about the contact" branch and the deal is left alone.
--   2. the reader now ignores a 'completed' enrolment whose reason mentions
--      payment, so the old shape cannot move a deal either.

CREATE OR REPLACE FUNCTION public.stop_enrollments_on_invoice_paid()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
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

    -- 'stopped', NOT 'completed'. The payment ended this early; the reminders
    -- did not run their course.
    UPDATE automation_enrollments
    SET status         = 'stopped',
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
$function$;

CREATE OR REPLACE FUNCTION public.move_deal_on_enrollment_exit()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  target_stage_id UUID;
  exit_replied    UUID;
  exit_no_reply   UUID;
  current_order   INT;
  target_order    INT;
BEGIN
  -- Only act on transitions out of 'active'.
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('completed', 'stopped') THEN
    RETURN NEW;
  END IF;

  -- Skip manual admin unenrolls — leave the deal where it is.
  IF NEW.status = 'stopped' AND COALESCE(NEW.stopped_reason, '') ILIKE 'manual%' THEN
    RETURN NEW;
  END IF;

  -- A payment ended this, whatever status it was recorded under. The deal is
  -- on its way to the paid stage and must not be routed through the "still
  -- unpaid" one. Checked before the branches below so neither can fire.
  IF COALESCE(NEW.stopped_reason, '') ILIKE '%paid%'
     OR COALESCE(NEW.stopped_reason, '') ILIKE '%payment%' THEN
    RETURN NEW;
  END IF;

  IF NEW.deal_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(a.exit_to_stage_id, NULLIF(a.config->>'exit_to_stage_id','')::uuid),
    COALESCE(a.no_reply_stage_id, NULLIF(a.config->>'no_reply_stage_id','')::uuid)
  INTO exit_replied, exit_no_reply
  FROM automations a
  WHERE a.id = NEW.automation_id;

  IF NEW.status = 'completed' THEN
    target_stage_id := exit_no_reply;
  ELSIF NEW.status = 'stopped' AND COALESCE(NEW.stopped_reason, '') ILIKE '%repl%' THEN
    target_stage_id := exit_replied;

    -- Forward only: a deal already at or past the replied stage stays put.
    SELECT cs.display_order, ts.display_order
    INTO current_order, target_order
    FROM deals d
    LEFT JOIN pipeline_stages cs ON cs.id = d.current_stage_id
    LEFT JOIN pipeline_stages ts ON ts.id = target_stage_id
    WHERE d.id = NEW.deal_id;

    IF current_order IS NOT NULL AND target_order IS NOT NULL
       AND target_order <= current_order THEN
      RETURN NEW;
    END IF;
  ELSE
    -- Stopped for a reason that says nothing about the contact (the recruiter
    -- moved the card, a stop stage was reached). The deal is already where
    -- somebody put it deliberately.
    RETURN NEW;
  END IF;

  IF target_stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE deals
  SET current_stage_id = target_stage_id
  WHERE id = NEW.deal_id
    AND current_stage_id IS DISTINCT FROM target_stage_id;

  RETURN NEW;
END;
$function$;
