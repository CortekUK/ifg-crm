-- Migration: stop active automation enrollments when an email reply is
-- attached to a contact. Previously this was done in JS inside the inbound
-- webhook only, which meant Smart Match and manual match never triggered an
-- exit. Moving it to a trigger covers every path that ever sets contact_id.
--
-- Fires on:
--   * INSERT into email_replies (webhook auto-match path)
--   * UPDATE of email_replies.contact_id (Smart Match, manual match, future
--     programmatic matches)
--
-- The `OF contact_id` clause means UPDATEs that touch other columns (e.g.
-- the trigger setting processed=true at the bottom) do NOT re-fire the
-- trigger — no recursion risk.

CREATE OR REPLACE FUNCTION stop_enrollments_on_reply_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- For UPDATEs, only act when contact_id actually changed. Defensive — the
  -- trigger's `OF contact_id` already filters most cases, but a SET to the
  -- same value still fires.
  IF TG_OP = 'UPDATE' AND OLD.contact_id IS NOT DISTINCT FROM NEW.contact_id THEN
    RETURN NEW;
  END IF;

  WITH eligible AS (
    SELECT ae.id, ae.deal_id
    FROM automation_enrollments ae
    JOIN deals d        ON ae.deal_id = d.id
    JOIN automations a  ON ae.automation_id = a.id
    WHERE d.contact_id = NEW.contact_id
      AND ae.status = 'active'
      AND COALESCE(a.exit_on_reply, (a.config->>'exit_on_reply')::boolean, true) = true
  ),
  stopped AS (
    UPDATE automation_enrollments
    SET status         = 'stopped',
        stopped_reason = 'Contact replied to email',
        next_step_at   = NULL
    WHERE id IN (SELECT id FROM eligible)
    RETURNING id, deal_id
  )
  INSERT INTO automation_logs (enrollment_id, deal_id, status, sent_at, log_type, error_message)
  SELECT id, deal_id, 'skipped', now(), 'enrollment_stopped', 'Contact replied to email'
  FROM stopped;

  -- FOUND reflects the last INSERT — true iff at least one enrollment was stopped.
  IF FOUND THEN
    UPDATE email_replies
    SET processed    = true,
        processed_at = now()
    WHERE id = NEW.id
      AND processed = false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_reply_match_stops_enrollments ON email_replies;
CREATE TRIGGER email_reply_match_stops_enrollments
AFTER INSERT OR UPDATE OF contact_id ON email_replies
FOR EACH ROW
EXECUTE FUNCTION stop_enrollments_on_reply_match();
