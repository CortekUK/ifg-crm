-- A follow-up sequence that stops because a RECRUITER moved the card must not
-- move the card back.
--
-- move_deal_on_enrollment_exit ended with a catch-all: any stop reason that
-- wasn't a manual unenroll sent the deal to the automation's "replied" stage.
-- Two very common reasons fall into that catch-all and neither means a reply:
--
--   "Deal moved to exit stage"    written by handle_deal_stage_change when a
--                                 deal enters one of the automation's stop
--                                 stages — i.e. because someone just moved it
--   "Auto-stopped on stage move"  written by the pipelines board for the same
--                                 reason, from the client side
--
-- So dragging a University player from Initial Lead to Zoom Scheduled stopped
-- the sequence, and the stop dragged them straight back to Contact Response —
-- both writes landing in one transaction, which is why the board appeared to
-- undo the move by itself. It only affected deals still in a live sequence,
-- which is why a second drag always stuck: by then there was no enrollment
-- left to stop. Twelve University deals were moved this way, and eleven of the
-- twelve deals sitting in Contact Response had never replied at all, which
-- made that stage useless as a list of people to call back.
--
-- A deal is now moved only when the outcome actually says something about the
-- contact:
--   completed                     -> the no-reply stage (sequence ran out)
--   stopped, reason mentions reply -> the replied stage (they wrote back)
--   anything else                  -> left exactly where it is
create or replace function public.move_deal_on_enrollment_exit()
returns trigger
language plpgsql
as $function$
DECLARE
  target_stage_id UUID;
  exit_replied    UUID;
  exit_no_reply   UUID;
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
