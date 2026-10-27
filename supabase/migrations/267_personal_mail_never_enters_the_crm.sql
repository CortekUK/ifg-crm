-- Personal mail never enters the CRM.
--
-- A connected Outlook mailbox brought EVERYTHING in: Instagram login codes,
-- bank sign-in alerts, shop promotions. 259 and 262 hid robots and colleagues
-- from the screen, but the rows were still stored, and a "new sign-in" email
-- from account-security@… matched none of those patterns, so it sat in the
-- Inbox as an unknown sender.
--
-- From this migration on the application filters before it stores
-- (lib/outlook/relevance.ts): mail that is not IFG business is never written
-- to email_replies, email_sends or email_threads. This file does the database
-- half of that:
--
--   1. outlook_filtered_messages — what the filter dropped, so a redelivered
--      notification is not re-checked (and re-billed). It holds a SHA-256 of
--      the message id and the rule that fired. No sender, subject or body.
--   2. a 'personal' category, and a one-off pass that files mail stored
--      BEFORE the filter under it. Hidden, not deleted — that was the decision
--      — and recorded in reclassified_personal_267 so it can be undone.
--   3. Scout no longer reads anyone's mailbox. v_scout_communications is
--      queried with the service role, which ignores 265's policies, so a
--      super_admin could ask Scout about any recruiter's Outlook mail.
--   4. The admin exception on email_sends (248) goes, matching what 265 did
--      for email_replies: a mailbox's sent mail is its owner's alone.

-- ── 1. the filter log ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outlook_filtered_messages (
  id              bigserial PRIMARY KEY,
  mailbox_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- sha256(internetMessageId), or of the Graph id when there is none.
  message_key     text NOT NULL,
  direction       text NOT NULL CHECK (direction IN ('inbound','outbound')),
  reason          text NOT NULL CHECK (reason IN (
                    'otp','account_security','consumer_service','automated_sender',
                    'bulk_mail','auto_generated','ai_personal')),
  filtered_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mailbox_user_id, message_key)
);

-- Written by the service role only. The owner may count their own (there is
-- nothing in a row but a hash and a reason); nobody else sees anything.
ALTER TABLE outlook_filtered_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS outlook_filtered_messages_select ON outlook_filtered_messages;
CREATE POLICY outlook_filtered_messages_select ON outlook_filtered_messages
  FOR SELECT TO authenticated
  USING (mailbox_user_id = auth.uid());

COMMENT ON TABLE outlook_filtered_messages IS
  'Outlook messages the relevance filter kept out of the CRM. Hash + reason only, never content.';

-- ── 2. 'personal', and the mail already stored ───────────────────────────
ALTER TABLE email_threads DROP CONSTRAINT IF EXISTS email_threads_category_check;
ALTER TABLE email_threads ADD CONSTRAINT email_threads_category_check
  CHECK (category = ANY (ARRAY['player','parent','secondary','internal','external','vendor','personal','unknown']));

ALTER TABLE email_replies DROP CONSTRAINT IF EXISTS email_replies_sender_kind_check;
ALTER TABLE email_replies ADD CONSTRAINT email_replies_sender_kind_check
  CHECK (sender_kind = ANY (ARRAY['player','parent','secondary','internal','external','vendor','personal','unknown']));

-- MIRRORS personalMarker() in lib/outlook/relevance-rules.ts, as far as SQL
-- can: subject and sender rules only. Headers were never stored, so a
-- newsletter that is caught only by its List-Unsubscribe header stays where
-- it is. Only mail with NO contact is touched, and only from the two
-- categories that mean "nobody has claimed this" — a person always wins.
CREATE OR REPLACE FUNCTION pg_temp.looks_personal(p_email text, p_subject text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT
    -- one-time codes and account security
    coalesce(p_subject, '') ~* (
      '\motp\M|one[- ]?time (pass ?(word|code)|code|pin|login)'
      || '|(verification|security|login|log-in|sign[- ]?in|confirmation|authentication|access|2fa|single-use) code'
      || '|\mpass ?code\M|your (\w+ )?code is|code:\s*[0-9]{4,8}|^\s*[0-9]{4,8}\s+is your'
      || '|verify your (email|e-mail|account|identity|login|device|phone|number|address)'
      || '|confirm your (email|e-mail|account|email address|registration|sign[- ]?up)'
      || '|(password|passcode) (reset|change|changed|was changed|expir)|reset your password'
      || '|new (sign[- ]?in|login|log-in|device)'
      || '|(sign[- ]?in|login|log-in) (attempt|alert|activity|notification|detected|from)'
      || '|(unusual|suspicious|unrecogni[sz]ed) (sign[- ]?in|login|activity|device)'
      || '|two[- ]?(factor|step)|2-?step verification|\m2fa\M'
      || '|security (alert|notification|warning|check)|account (alert|security|recovery|locked|suspended)'
      || '|someone (tried to|signed in|logged in)'
    )
    -- consumer services (never webmail: parents write from gmail/hotmail/icloud)
    OR lower(split_part(coalesce(p_email, ''), '@', 2)) ~ (
      '(^|\.)(instagram\.com|facebookmail\.com|facebook\.com|meta\.com|whatsapp\.com|messenger\.com'
      || '|threads\.net|tiktok\.com|snapchat\.com|x\.com|twitter\.com|pinterest\.com|reddit\.com'
      || '|redditmail\.com|discord\.com|telegram\.org|linkedin\.com|google\.com|youtube\.com'
      || '|apple\.com|accountprotection\.microsoft\.com|amazon\.com|amazon\.co\.uk|paypal\.com'
      || '|paypal\.co\.uk|ebay\.com|ebay\.co\.uk|netflix\.com|spotify\.com|primevideo\.com'
      || '|disneyplus\.com|uber\.com|deliveroo\.co\.uk|just-eat\.co\.uk|temu\.com|shein\.com|aliexpress\.com)$'
    )
    -- the address-only robots 259 did not cover
    OR lower(split_part(coalesce(p_email, ''), '@', 1)) ~
      '^(alerts?([-_.]|$)|security([-_.]|$)|account[-_.]?security|verify([-_.]|$)|marketing([-_.]|$)|newsletters?([-_.]|$)|promo(tions?)?([-_.]|$))'
$$;

CREATE TABLE IF NOT EXISTS reclassified_personal_267 (
  id             bigserial PRIMARY KEY,
  changed_at     timestamptz NOT NULL DEFAULT now(),
  source_table   text NOT NULL,
  row_id         uuid NOT NULL,
  previous_value text
);
-- Same exposure 266 closed on the other backup tables: no policy, no API reach.
ALTER TABLE reclassified_personal_267 ENABLE ROW LEVEL SECURITY;

INSERT INTO reclassified_personal_267 (source_table, row_id, previous_value)
SELECT 'email_threads', id, category FROM email_threads
WHERE source = 'outlook' AND contact_id IS NULL
  AND category IN ('unknown', 'external')
  AND pg_temp.looks_personal(counterparty_email, subject);

UPDATE email_threads SET category = 'personal'
WHERE id IN (SELECT row_id FROM reclassified_personal_267 WHERE source_table = 'email_threads');

INSERT INTO reclassified_personal_267 (source_table, row_id, previous_value)
SELECT 'email_replies', id, sender_kind FROM email_replies
WHERE source = 'outlook' AND contact_id IS NULL
  AND sender_kind IN ('unknown', 'external')
  AND pg_temp.looks_personal(from_email, subject);

UPDATE email_replies SET sender_kind = 'personal'
WHERE id IN (SELECT row_id FROM reclassified_personal_267 WHERE source_table = 'email_replies');

-- ── 3. Scout stops reading mailboxes ─────────────────────────────────────
-- Same columns as 249, with Outlook rows removed from both halves. Campaign,
-- automation and invoice mail (source <> 'outlook') is unchanged.
CREATE OR REPLACE VIEW public.v_scout_communications AS
SELECT 'email_send'::text AS channel,
    es.id::text AS id,
    es.recipient_contact_id AS contact_id,
    es.recipient_email AS counterpart,
    es.subject,
    NULL::text AS body_preview,
    es.status,
    NULL::text AS intent,
    es.campaign_id,
    NULL::uuid AS deal_id,
    NULL::uuid AS pipeline_id,
    es.sent_at AS occurred_at,
    es.created_at
   FROM email_sends es
  WHERE es.source IS DISTINCT FROM 'outlook'
UNION ALL
 SELECT 'email_reply'::text AS channel,
    er.id::text AS id,
    er.contact_id,
    er.from_email AS counterpart,
    er.subject,
    er.body_preview,
    er.status,
    er.ai_intent AS intent,
    er.campaign_id,
    er.deal_id,
    er.pipeline_id,
    er.received_at AS occurred_at,
    er.created_at
   FROM email_replies er
  WHERE er.source IS DISTINCT FROM 'outlook';

-- ── 4. sent mail is its owner's too ──────────────────────────────────────
DROP POLICY IF EXISTS email_sends_select ON email_sends;
CREATE POLICY email_sends_select ON email_sends FOR SELECT TO authenticated
  USING (
    CASE WHEN source = 'outlook'
      THEN mailbox_user_id = auth.uid()
      ELSE (SELECT public.is_staff())
    END
  );

COMMENT ON POLICY email_sends_select ON email_sends IS
  'Bulk sends stay team-wide so Reports/Analytics keep counting. Outlook sends are readable by the sending mailbox only (267).';
