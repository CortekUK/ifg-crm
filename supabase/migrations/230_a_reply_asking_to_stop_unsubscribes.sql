-- QA-29 Bug 2: "Please stop emailing" was labelled negative and the contact
-- stayed subscribed.
--
-- The classifier could only ever return positive / negative / neutral /
-- question / unknown, so there was no way to say "this person asked to be
-- removed" — even though the pipeline card already has a badge style for it.
-- A player who replies asking to stop keeps receiving the rest of the
-- sequence, which is the one reply the system must act on without a human.
--
-- Two parts: widen the allowed values, and make the label do something.

ALTER TABLE email_replies DROP CONSTRAINT IF EXISTS email_replies_ai_intent_check;
ALTER TABLE email_replies ADD CONSTRAINT email_replies_ai_intent_check
  CHECK (ai_intent = ANY (ARRAY[
    'positive'::text, 'negative'::text, 'neutral'::text,
    'question'::text, 'unknown'::text, 'unsubscribe'::text
  ]));

-- An unsubscribe request takes the contact off email immediately, by the same
-- three columns the unsubscribe link writes (app/api/public/unsubscribe):
--   subscription_status  — what the automation engine gates sends on
--   email_subscribed     — the per-channel flag
--   unsubscribed_at      — when, for reporting
-- Doing it in a trigger means every route in gets the same result: an inbound
-- reply, a hand-match, or a recruiter correcting a label to 'unsubscribe'.
CREATE OR REPLACE FUNCTION unsubscribe_contact_on_reply_request()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.ai_intent, NEW.intent) <> 'unsubscribe' THEN
    RETURN NEW;
  END IF;
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE contacts
  SET subscription_status = 'unsubscribed',
      email_subscribed    = false,
      unsubscribed_at     = COALESCE(unsubscribed_at, NOW())
  WHERE id = NEW.contact_id
    AND (subscription_status IS DISTINCT FROM 'unsubscribed' OR email_subscribed IS DISTINCT FROM false);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION unsubscribe_contact_on_reply_request() IS
  'QA-29 Bug 2: a reply classified ''unsubscribe'' takes the contact off email, '
  'the same way the unsubscribe link does.';

DROP TRIGGER IF EXISTS email_reply_unsubscribes_contact ON email_replies;
CREATE TRIGGER email_reply_unsubscribes_contact
AFTER INSERT OR UPDATE OF ai_intent, intent, contact_id ON email_replies
FOR EACH ROW
WHEN (COALESCE(NEW.ai_intent, NEW.intent) = 'unsubscribe' AND NEW.contact_id IS NOT NULL)
EXECUTE FUNCTION unsubscribe_contact_on_reply_request();
