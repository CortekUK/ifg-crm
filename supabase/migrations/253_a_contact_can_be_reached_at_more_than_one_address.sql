-- Migration 253: secondary email addresses for a contact.
--
-- The mailbox needs to answer one question on every inbound message: "whose
-- email is this?" Today it can only check contacts.email and
-- contacts.parent_email, so a player writing from a second account — a school
-- address, a personal one, a parent's — lands as Unmatched every time, and a
-- human has to connect it again and again.
--
-- This table is what makes "save this address as a secondary email" stick:
-- once an address is recorded here, every future message from it matches by
-- itself.
--
-- ADDITIVE ONLY. Nothing existing reads this table, so the currently deployed
-- application is unaffected — which, after 251 and 252, is the rule now.

CREATE TABLE IF NOT EXISTS contact_emails (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  -- Which inbox this address belongs to, so the mailbox can label a message
  -- "Player" or "Parent" rather than just "matched".
  kind        TEXT NOT NULL DEFAULT 'secondary'
                CHECK (kind IN ('secondary', 'parent', 'school', 'other')),
  -- Who connected it, and when. An address attached to the wrong player is
  -- the kind of mistake that needs to be traceable.
  added_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One address belongs to exactly one contact. Without this the same address
-- could be connected to two players and every later message would match
-- whichever row the planner happened to return first.
CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_emails_email
  ON contact_emails(LOWER(email));

CREATE INDEX IF NOT EXISTS idx_contact_emails_contact ON contact_emails(contact_id);

ALTER TABLE contact_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_emails_select ON contact_emails;
CREATE POLICY contact_emails_select ON contact_emails FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));

DROP POLICY IF EXISTS contact_emails_write ON contact_emails;
CREATE POLICY contact_emails_write ON contact_emails FOR ALL TO authenticated
  USING ((SELECT public.is_staff()))
  WITH CHECK ((SELECT public.is_staff()));

COMMENT ON TABLE contact_emails IS
  'Extra addresses a contact writes from. Connecting an unmatched email here makes every later message from that address match on its own.';

-- ── one rule for "whose address is this?" ────────────────────────────────
-- Used by the ingest AND by the mailbox screen, so a message cannot be
-- labelled Player in one place and Parent in another. Returns the contact
-- plus HOW it matched, which is exactly the tag the thread shows.
CREATE OR REPLACE FUNCTION public.resolve_contact_by_email(p_email TEXT)
RETURNS TABLE (contact_id UUID, match_kind TEXT)
LANGUAGE sql
STABLE
AS $function$
  WITH needle AS (SELECT LOWER(TRIM(p_email)) AS e),
  candidates AS (
    -- The player's own address wins.
    SELECT c.id AS cid, 'player'::text AS kind, 1 AS priority
      FROM contacts c, needle n
     WHERE LOWER(c.email) = n.e
    UNION ALL
    -- Then the parent/guardian address already on the record.
    SELECT c.id, 'parent'::text, 2
      FROM contacts c, needle n
     WHERE c.parent_email IS NOT NULL AND LOWER(c.parent_email) = n.e
    UNION ALL
    -- Then anything connected by hand in the mailbox.
    SELECT ce.contact_id,
           CASE WHEN ce.kind = 'parent' THEN 'parent' ELSE 'secondary' END,
           3
      FROM contact_emails ce, needle n
     WHERE LOWER(ce.email) = n.e
  )
  -- Priority decides, so an address that is somehow both a primary and a
  -- connected secondary resolves the same way every time rather than
  -- depending on which row the planner returns first.
  SELECT cid, kind FROM candidates ORDER BY priority LIMIT 1
$function$;

GRANT EXECUTE ON FUNCTION public.resolve_contact_by_email(TEXT) TO authenticated;
