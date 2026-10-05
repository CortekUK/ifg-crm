-- A reply must never drag a deal backwards.
--
-- When a contact replies, stop_enrollments_on_reply_match() stops the
-- enrollment with a "...replied..." reason, and move_deal_on_enrollment_exit()
-- then moved the deal to the automation's replied stage unconditionally.
-- UNIVERSITY OF LANCASHIRE - FOLLOW UP MAP runs on Follow Up and has
-- Contact Response as its replied stage, so a player in Follow Up who replied
-- was pulled back to Contact Response — an earlier stage. The inbound email
-- handler already refuses to move a deal that is past Contact Response; this
-- brings the trigger in line.
--
-- The replied move now happens only when the replied stage is LATER than the
-- deal's current stage. The no-reply move (sequence completed) is unchanged:
-- moving to Dormant is backwards on purpose.
create or replace function public.move_deal_on_enrollment_exit()
returns trigger
language plpgsql
as $function$
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
    -- moved the card, an invoice was paid, a stop stage was reached). The deal
    -- is already where somebody put it deliberately.
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
