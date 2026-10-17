-- Keep colleague mail out of the mailbox.
--
-- The mailbox is for conversations with CRM contacts. It was showing Nathan's
-- mail with Lindsay at the club, and Lindsay's with Callum at the agency,
-- mixed in with players.
--
-- WHY: is_staff_email asked the profiles table "does this person have a CRM
-- login?". Lindsay does not. Nor do mick@, jake@, alexmarr@, rachael@, ceo@,
-- garethprendergast@, or the shared IFG addresses admin@, accounts@, media@
-- and info@. All of them came back "not staff" and were filed as strangers.
--
-- Worse for Lindsay specifically: she is also in contacts from an old CSV
-- import, so her 17 threads were filed as 'player' and sat in the Contacts
-- folder as though she were a prospect. Nine club and IFG addresses are in
-- contacts that way. Every one of them has zero deals — none is a lead.
--
-- THE FIX IS ADDITIVE, NOT A REPLACEMENT. Migration 254 chose profiles over a
-- domain list on purpose, so that staff on a future third domain would still
-- be recognised, and that reasoning still holds. The profiles check stays and
-- the domains are added alongside it: a login OR one of the two professional
-- domains. The two domains are the same pair migration 150 already hardcodes
-- to decide who may sign up, so this introduces no new assumption about who
-- works here.
--
-- 'internal' is already in HIDDEN_CATEGORIES, so this hides 78 threads from
-- every folder without deleting anything.
--
-- REVERSIBLE: the previous category of every row changed here is recorded in
-- reclassified_internal_262.

CREATE OR REPLACE FUNCTION public.is_staff_email(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $function$
  SELECT
    EXISTS (
      SELECT 1 FROM profiles
       WHERE LOWER(email) = LOWER(TRIM(p_email))
         AND role IN ('admin','super_admin','recruiter')
    )
    OR LOWER(TRIM(p_email)) ~ '@(macclesfieldfc\.com|theinternationalfootballgroup\.com)$'
$function$;

GRANT EXECUTE ON FUNCTION public.is_staff_email(TEXT) TO authenticated;

CREATE TABLE IF NOT EXISTS reclassified_internal_262 (
  id            bigserial PRIMARY KEY,
  changed_at    timestamptz NOT NULL DEFAULT now(),
  source_table  text NOT NULL,
  row_id        uuid NOT NULL,
  previous_value text
);

INSERT INTO reclassified_internal_262 (source_table, row_id, previous_value)
SELECT 'email_threads', id, category FROM email_threads
WHERE category <> 'internal' AND public.is_staff_email(counterparty_email);

INSERT INTO reclassified_internal_262 (source_table, row_id, previous_value)
SELECT 'email_replies', id, sender_kind FROM email_replies
WHERE coalesce(sender_kind,'') <> 'internal' AND public.is_staff_email(from_email);

UPDATE email_threads SET category = 'internal'
WHERE category <> 'internal' AND public.is_staff_email(counterparty_email);

UPDATE email_replies SET sender_kind = 'internal'
WHERE coalesce(sender_kind,'') <> 'internal' AND public.is_staff_email(from_email);
