-- Migration: scope exit-on-reply to a single automation enrollment instead of
-- stopping every active enrollment for the contact.
--
-- Old behaviour (083): one reply silenced every active automation the contact
-- was in across every pipeline. Useful for "human took over" scenarios but
-- prevents running parallel programmes per contact.
--
-- New behaviour: stop only the enrollment whose outbound email this reply
-- threads to. Resolution order:
--   1. exact thread — match `email_replies.email_send_id` (set by the inbound
--      webhook from the In-Reply-To header) → email_sends.automation_log_id
--      → automation_logs.enrollment_id
--   2. fallback — the most recent email_send to this contact in the last
--      30 days from an automation with exit_on_reply = true. Logged with a
--      distinct stopped_reason so audit can tell the difference.
--
-- If neither resolves, no enrollment is stopped — the reply still lands in
-- the Replies inbox for human review.

CREATE OR REPLACE FUNCTION stop_enrollments_on_reply_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_enrollment_id UUID;
  target_deal_id UUID;
  stop_reason TEXT;
BEGIN
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.contact_id IS NOT DISTINCT FROM NEW.contact_id THEN
    RETURN NEW;
  END IF;

  -- Path 1: exact thread match via email_send → automation_log → enrollment.
  IF NEW.email_send_id IS NOT NULL THEN
    SELECT al.enrollment_id, al.deal_id
    INTO target_enrollment_id, target_deal_id
    FROM email_sends es
    JOIN automation_logs al ON es.automation_log_id = al.id
    JOIN automation_enrollments ae ON ae.id = al.enrollment_id
    JOIN automations a ON ae.automation_id = a.id
    WHERE es.id = NEW.email_send_id
      AND ae.status = 'active'
      AND COALESCE(a.exit_on_reply, (a.config->>'exit_on_reply')::boolean, true) = true
    LIMIT 1;

    IF target_enrollment_id IS NOT NULL THEN
      stop_reason := 'Contact replied to email';
    END IF;
  END IF;

  -- Path 2: fallback — most recent automation email to this contact.
  -- Threading headers can be stripped by corporate gateways or absent when a
  -- contact starts a fresh email instead of hitting Reply. The most recent
  -- send is almost always what they meant to respond to.
  IF target_enrollment_id IS NULL THEN
    SELECT al.enrollment_id, al.deal_id
    INTO target_enrollment_id, target_deal_id
    FROM email_sends es
    JOIN automation_logs al ON es.automation_log_id = al.id
    JOIN automation_enrollments ae ON ae.id = al.enrollment_id
    JOIN automations a ON ae.automation_id = a.id
    WHERE es.recipient_contact_id = NEW.contact_id
      AND ae.status = 'active'
      AND COALESCE(a.exit_on_reply, (a.config->>'exit_on_reply')::boolean, true) = true
      AND es.sent_at > now() - interval '30 days'
    ORDER BY es.sent_at DESC
    LIMIT 1;

    IF target_enrollment_id IS NOT NULL THEN
      stop_reason := 'Replied (matched by most recent send — thread headers missing)';
    END IF;
  END IF;

  -- Nothing to stop — reply still recorded for human review.
  IF target_enrollment_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE automation_enrollments
  SET status         = 'stopped',
      stopped_reason = stop_reason,
      next_step_at   = NULL
  WHERE id = target_enrollment_id;

  INSERT INTO automation_logs (enrollment_id, deal_id, status, sent_at, log_type, error_message)
  VALUES (target_enrollment_id, target_deal_id, 'skipped', now(), 'enrollment_stopped', stop_reason);

  UPDATE email_replies
  SET processed    = true,
      processed_at = now()
  WHERE id = NEW.id
    AND processed = false;

  RETURN NEW;
END;
$$;

-- Trigger itself is unchanged from migration 083 — keep the same name + binding.
DROP TRIGGER IF EXISTS email_reply_match_stops_enrollments ON email_replies;
CREATE TRIGGER email_reply_match_stops_enrollments
AFTER INSERT OR UPDATE OF contact_id ON email_replies
FOR EACH ROW
EXECUTE FUNCTION stop_enrollments_on_reply_match();
