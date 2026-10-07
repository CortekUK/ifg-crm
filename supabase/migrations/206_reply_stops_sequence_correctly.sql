-- QA-30: three ways an inbound reply did the wrong thing to a deal.
--
-- Bug 1 — a reply the AI could not read still moved the deal.
--   The reply handler checks the intent before moving. The automation's own
--   "when the player replies, move to stage" path did not, so an out-of-office
--   auto-reply moved the card to Contact Response. Real replies on 27 Sep and
--   2 Oct had no intent and their deals were moved anyway.
--
--   The move happens in move_deal_on_enrollment_exit, which fires when an
--   enrolment stops with a reason matching '%repl%'. So the fix is to choose
--   the stop reason by whether an intent was decided: a readable reply keeps
--   the reply wording and still moves the deal; an unreadable one stops the
--   sequence with wording that contains no "repl", which drops through to the
--   "says nothing about the contact" branch and leaves the card alone.
--
--   This only works because resend-inbound now classifies BEFORE inserting the
--   reply — previously ai_intent was patched in afterwards, so at the moment
--   this trigger ran it was always NULL.
--
-- Bug 2 — replying to an old email moved a deal in a DIFFERENT pipeline.
--   When the reply's own sequence had already finished, the handler fell back
--   to "the most recent automation email sent to this contact in 30 days" and
--   stopped that instead. A player in both UK Gap and University replying late
--   to a UK Gap email had their University follow-ups stopped and the
--   University deal moved. The fallback now runs ONLY when the reply cannot be
--   tied to an email at all, which is the case it was written for.
--
-- Bug 3 — moving a deal back restarted the sequence, and an old reply killed it.
--   Unprocessed replies from weeks earlier were matched to the freshly
--   restarted enrolment and stopped it within seconds, with no email sent and
--   the card jumping to Contact Response. A reply can only stop an enrolment
--   that already existed when the reply arrived.

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
      AND ae.created_at <= COALESCE(NEW.received_at, NOW())
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
      AND ae.created_at <= COALESCE(NEW.received_at, NOW())
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
