-- CRITICAL. Migration 206 referenced a column that does not exist, and the
-- function it defines runs on every inbound reply.
--
-- `automation_enrollments` has no `created_at`. The column is `enrolled_at`.
-- Postgres accepts the function body at CREATE time — a plpgsql body is only
-- parsed, not planned — so 206 applied cleanly and looked fine. The reference
-- is resolved the first time the statement actually runs, which is inside the
-- trigger on email_replies, where it raises:
--
--   column ae.created_at does not exist
--
-- Both branches carry the bad reference, so EVERY path through the function
-- fails: the trigger is AFTER INSERT OR UPDATE OF contact_id, it aborts the
-- statement that fired it, and the whole transaction with it. The practical
-- effect since 206 was applied:
--
--   * every inbound reply insert from resend-inbound failed, so the webhook
--     errored and the reply was never recorded — replies have been silently
--     dropped, not merely mis-handled
--   * every manual match (Smart Match, the Match dialog) failed the same way
--
-- Verified against the live database before and after: inserting a reply with
-- a linked send and without one both raised the error, and both succeed now.
--
-- `enrolled_at` is NOT NULL in practice (1,186 of 1,186 rows populated), but
-- COALESCE keeps a null from quietly excluding an enrolment from the guard and
-- so re-opening bug 3 — a null date would make the comparison NULL, the row
-- would not match, and the reply would fail to stop a sequence it should have
-- stopped.

CREATE OR REPLACE FUNCTION stop_enrollments_on_reply_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_enrollment_id UUID;
  target_deal_id UUID;
  stop_reason TEXT;
  has_intent BOOLEAN;
BEGIN
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.contact_id IS NOT DISTINCT FROM NEW.contact_id THEN
    RETURN NEW;
  END IF;

  has_intent := COALESCE(NEW.ai_intent, NEW.intent) IS NOT NULL;

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
      -- Bug 3: only an enrolment that already existed when this reply arrived.
      AND COALESCE(ae.enrolled_at, '-infinity'::timestamptz) <= COALESCE(NEW.received_at, NOW())
    LIMIT 1;

    IF target_enrollment_id IS NOT NULL THEN
      stop_reason := CASE
        WHEN has_intent THEN 'Contact replied to email'
        ELSE 'Contact responded, intent unreadable — sequence stopped, deal not moved'
      END;
    END IF;
  ELSE
    -- Bug 2: the "most recent send" fallback is ONLY for a reply we could not
    -- tie to an email. When the reply IS linked but its sequence has finished,
    -- there is nothing to stop — reaching into another pipeline is not a
    -- fallback, it is a different conversation.
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
      AND COALESCE(ae.enrolled_at, '-infinity'::timestamptz) <= COALESCE(NEW.received_at, NOW())
    ORDER BY es.sent_at DESC
    LIMIT 1;

    IF target_enrollment_id IS NOT NULL THEN
      stop_reason := CASE
        WHEN has_intent THEN 'Replied (matched by most recent send — thread headers missing)'
        ELSE 'Responded, intent unreadable (matched by most recent send) — deal not moved'
      END;
    END IF;
  END IF;

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
  SET processed = true
  WHERE id = NEW.id
    AND processed = false;

  RETURN NEW;
END;
$$;
