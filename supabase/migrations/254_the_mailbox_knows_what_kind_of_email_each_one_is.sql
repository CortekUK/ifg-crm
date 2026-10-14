-- Migration 254: classify every message and every thread.
--
-- The mailbox has folders — Inbox, Unmatched, Matched, Sent, Internal,
-- External — and tags on each row (Player, Parent, Internal, External,
-- Secondary email, Unknown sender). All of that is one question asked of each
-- message: who sent it, and what are they to us?
--
-- Deciding that at read time would mean re-resolving every address on every
-- paint, over a list that has to page. So it is decided once, when the message
-- is ingested, and stored.
--
-- ADDITIVE ONLY — nothing deployed reads these columns.

-- ── per message ──────────────────────────────────────────────────────────
ALTER TABLE email_replies
  -- player   — the contact's own address
  -- parent   — the parent/guardian address on the record
  -- secondary— an address connected by hand (contact_emails)
  -- internal — a colleague: another staff mailbox in this CRM
  -- external — a real person or system that is not a contact (supplier,
  --            booking, ticket office). Deliberately distinct from 'unknown':
  --            external has been judged and filed, unknown is still waiting.
  -- unknown  — not recognised, sitting in Unmatched for someone to connect
  ADD COLUMN IF NOT EXISTS sender_kind TEXT NOT NULL DEFAULT 'unknown'
    CHECK (sender_kind IN ('player','parent','secondary','internal','external','unknown'));

ALTER TABLE email_sends
  ADD COLUMN IF NOT EXISTS sender_kind TEXT NOT NULL DEFAULT 'player';

-- ── per thread ───────────────────────────────────────────────────────────
ALTER TABLE email_threads
  -- Which folder the conversation belongs in. Mirrors sender_kind, but for the
  -- thread as a whole: a thread is only Unmatched while nobody in it is known.
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'unknown'
    CHECK (category IN ('player','parent','secondary','internal','external','unknown')),
  -- Everyone on the conversation, for the "me, Westin, Sarah" line the list
  -- shows. Stored because deriving it needs every message in the thread.
  ADD COLUMN IF NOT EXISTS participants JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- The newest intent in the thread, so the row can carry a tag without
  -- loading its messages.
  ADD COLUMN IF NOT EXISTS latest_intent TEXT;

CREATE INDEX IF NOT EXISTS idx_email_threads_category
  ON email_threads(mailbox_user_id, category, last_message_at DESC NULLS LAST);

COMMENT ON COLUMN email_replies.sender_kind IS
  'Who sent it: player | parent | secondary | internal | external | unknown. Decided at ingest so the list does not re-resolve addresses on every paint.';
COMMENT ON COLUMN email_threads.category IS
  'Folder the conversation belongs to. external = judged and filed; unknown = still waiting to be connected.';

-- ── is this address one of our own staff? ────────────────────────────────
-- Used to tell internal mail from everything else. Checks the profiles table
-- rather than a hard-coded domain list: staff sit on two domains already
-- (macclesfieldfc.com and theinternationalfootballgroup.com) and a third would
-- otherwise silently be filed as external.
CREATE OR REPLACE FUNCTION public.is_staff_email(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM profiles
     WHERE LOWER(email) = LOWER(TRIM(p_email))
       AND role IN ('admin','super_admin','recruiter')
  )
$function$;

GRANT EXECUTE ON FUNCTION public.is_staff_email(TEXT) TO authenticated;
