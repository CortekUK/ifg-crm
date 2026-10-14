-- Migration 247: conversation threads for the mailbox screen.
--
-- The spec asks for "a list of CONVERSATIONS, not individual messages, with an
-- unread count". Computing that by aggregating email_replies + email_sends on
-- every paint is exactly the shape of query that hits the 1,000-row ceiling —
-- the trap that has already cost this project three bugs (exports, tag
-- filtering, reports) and is called out again in the spec's own warnings.
--
-- So the thread list is a real table, maintained as messages land, and the
-- screen pages over it with .range(). One row per conversation PER MAILBOX:
-- two recruiters on the same thread each get their own row, because each sees
-- their own unread count and each must be scoped to their own mailbox.

CREATE TABLE IF NOT EXISTS email_threads (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Graph's conversationId. For Resend-era mail with no conversation we fall
  -- back to a synthetic key (see thread_key_for_resend below).
  conversation_id    TEXT NOT NULL,
  mailbox_user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,

  subject            TEXT,
  -- Denormalised so the list renders without joining either message table.
  last_message_at    TIMESTAMPTZ,
  last_message_preview TEXT,
  last_message_from  TEXT,
  -- 'inbound' | 'outbound' — drives the "you replied" affordance in the list.
  last_message_direction TEXT,

  unread_count       INTEGER NOT NULL DEFAULT 0,
  message_count      INTEGER NOT NULL DEFAULT 0,

  -- Who the thread is with, when we can tell. Kept nullable on purpose: a
  -- thread with someone who is not in the CRM is still a real thread and must
  -- still be listed (that is the "unmatched" side of the screen).
  contact_id         UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id            UUID REFERENCES deals(id) ON DELETE SET NULL,
  pipeline_id        UUID REFERENCES pipelines(id) ON DELETE SET NULL,
  -- The counterparty address, so an unmatched thread still shows who it is with.
  counterparty_email TEXT,
  counterparty_name  TEXT,

  -- TRUE when the counterparty matches a CRM contact. This is the flag the
  -- Matched / Unmatched tabs filter on, and it is also the privacy boundary:
  -- a thread that is NOT CRM-related is the recruiter's own correspondence and
  -- is never shown to an admin (see policy below).
  is_crm_related     BOOLEAN NOT NULL DEFAULT false,

  source             TEXT NOT NULL DEFAULT 'outlook',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One thread per conversation per mailbox.
  UNIQUE (conversation_id, mailbox_user_id)
);

-- The list's default ordering, scoped to one mailbox. Composite because the
-- query is always "my threads, newest first" — two separate indexes would make
-- the planner choose one and sort the rest.
CREATE INDEX IF NOT EXISTS idx_email_threads_mailbox_recent
  ON email_threads(mailbox_user_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_email_threads_contact
  ON email_threads(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_crm_related
  ON email_threads(mailbox_user_id, is_crm_related, last_message_at DESC NULLS LAST);

ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;

-- Visibility, and the one genuinely delicate rule in this feature.
--
--   Recruiter → their own mailbox's threads only.
--   Admin     → every mailbox's CRM-RELATED threads.
--
-- The second half is the limit. "Sync all their Outlook mail" means a
-- recruiter's mailbox also contains HR mail, payroll, personal correspondence
-- and internal threads that have nothing to do with IFG's players. Letting an
-- admin read those would turn a CRM feature into mailbox surveillance, so
-- is_crm_related gates it: an admin sees every thread with a player, and none
-- of a colleague's private mail. The mailbox owner still sees their own
-- everything, which is what makes it feel like Gmail.
--
-- Flagged for Ghulam rather than decided quietly — the code is written so
-- widening it later is one policy edit.
DROP POLICY IF EXISTS email_threads_select ON email_threads;
CREATE POLICY email_threads_select ON email_threads FOR SELECT TO authenticated
  USING (
    mailbox_user_id = auth.uid()
    OR ((SELECT public.is_admin()) AND is_crm_related)
  );

-- Writes come from server routes under the service role, which bypasses RLS.
-- Owners may still update their own threads so "mark read" works from the
-- client without a round trip.
DROP POLICY IF EXISTS email_threads_update ON email_threads;
CREATE POLICY email_threads_update ON email_threads FOR UPDATE TO authenticated
  USING (mailbox_user_id = auth.uid())
  WITH CHECK (mailbox_user_id = auth.uid());

COMMENT ON TABLE email_threads IS
  'One row per conversation per mailbox. Exists so the mailbox list pages with .range() instead of aggregating messages client-side and silently stopping at 1,000 rows.';
COMMENT ON COLUMN email_threads.is_crm_related IS
  'TRUE when the counterparty is a CRM contact. Gates admin visibility: admins see players, never a colleague''s private mail.';

CREATE OR REPLACE FUNCTION touch_email_threads()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_email_threads ON email_threads;
CREATE TRIGGER trg_touch_email_threads
  BEFORE UPDATE ON email_threads
  FOR EACH ROW EXECUTE FUNCTION touch_email_threads();
