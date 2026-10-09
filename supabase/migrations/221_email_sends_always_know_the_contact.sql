-- QA-07: a reply from a different address landed "unmatched" even though the
-- CRM knew exactly which email it answered.
--
-- resend-inbound already has the right fallback (section 2.6): when the
-- sender's address matches no contact, it takes the contact from the
-- email_sends row the reply is threaded to. That is deployed and correct.
-- It found nothing because the SEND had no contact on it either:
--
--   396 of 2,296 email_sends have recipient_contact_id NULL.
--
-- All five of QA's test replies were threaded to such a row. The reply came
-- from hamza.shafique12123@gmail.com answering a send addressed to
-- hamza.shafique12123+20@gmail.com — a real contact — but the send never
-- recorded who it was for, so there was nothing to fall back to.
--
-- Automation sends are fine (1,881 of 1,881). The gap is every other sender:
-- supabase/functions/send-email takes recipient_contact_id as an OPTIONAL
-- parameter and writes NULL when a caller omits it, and several callers do.
--
-- Fixing it here rather than in each caller, for two reasons: it covers every
-- writer at once (three edge functions and two API routes today, plus
-- whatever is added next), and it takes effect without redeploying any edge
-- function. recipient_email is NOT NULL, so the address is always available
-- to resolve from.
--
-- Safe to match on email: contacts.email has no duplicates on this database
-- (0 addresses appear twice), so the lookup cannot pick the wrong person.
-- Anything that still does not resolve — a send to someone who was never a
-- contact, or who has since been deleted — is left NULL, exactly as now.

CREATE OR REPLACE FUNCTION fill_email_send_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.recipient_contact_id IS NULL AND NEW.recipient_email IS NOT NULL THEN
    SELECT c.id INTO NEW.recipient_contact_id
    FROM contacts c
    WHERE lower(c.email) = lower(NEW.recipient_email)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_email_send_fill_contact ON email_sends;
CREATE TRIGGER on_email_send_fill_contact
  BEFORE INSERT OR UPDATE OF recipient_email, recipient_contact_id ON email_sends
  FOR EACH ROW
  EXECUTE FUNCTION fill_email_send_contact();

-- Repair the rows already written. 244 of the 396 resolve to a contact that
-- still exists; the rest keep their NULL. This only sets a column that was
-- empty, so no existing link is overwritten.
UPDATE email_sends s
SET recipient_contact_id = c.id
FROM contacts c
WHERE s.recipient_contact_id IS NULL
  AND lower(c.email) = lower(s.recipient_email);
