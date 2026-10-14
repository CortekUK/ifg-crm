-- Migration 245: give every email a mailbox owner and a conversation.
--
-- Groundwork for the Outlook mailbox. Columns only — nothing is enforced here
-- and no behaviour changes. The RLS switch that USES mailbox_user_id is
-- migration 248, deliberately separate so this can ship and be verified on its
-- own.
--
-- WHY mailbox ownership and not contact ownership:
-- Migration 175 widened recruiters to the whole book ("every contact, every
-- pipeline") as a product decision. So the ownership rule 101 put on
-- email_replies — contact_id IN (SELECT id FROM contacts) — no longer narrows
-- anything at all: every recruiter passes it for every contact. Scoping mail
-- by WHOSE MAILBOX sent or received it is the only rule that still means
-- something, and it is also what the spec asks for: a recruiter sees the mail
-- they sent and the replies they got.

-- ── email_replies ────────────────────────────────────────────────────────
ALTER TABLE email_replies
  -- The CRM user whose connected mailbox this message arrived in. NULL means
  -- it came through the bulk sender (Resend) and belongs to no one mailbox —
  -- those stay admin-visible, exactly as unmatched replies already are.
  ADD COLUMN IF NOT EXISTS mailbox_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Microsoft Graph's conversationId. The thread key for everything Outlook;
  -- NULL for Resend mail, which threads via tracking_id / in_reply_to instead.
  ADD COLUMN IF NOT EXISTS conversation_id TEXT,
  -- Graph's internetMessageId (the RFC Message-ID as Microsoft reports it).
  -- Kept apart from the existing message_id column, which the Resend path
  -- already dedupes on, so neither provider can disturb the other's dedupe.
  ADD COLUMN IF NOT EXISTS internet_message_id TEXT,
  -- Graph's immutable message id, for calling back into the mailbox (reply,
  -- mark read). Scoped to the mailbox it came from.
  ADD COLUMN IF NOT EXISTS graph_message_id TEXT,
  -- 'resend' | 'outlook'. Which pipe delivered this. Lets the UI and any
  -- future debugging tell the two apart without guessing from NULLs.
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'resend';

COMMENT ON COLUMN email_replies.mailbox_user_id IS
  'CRM user whose connected Outlook received this. NULL = arrived via the bulk sender (Resend).';
COMMENT ON COLUMN email_replies.conversation_id IS
  'Microsoft Graph conversationId — the thread key for Outlook mail.';
COMMENT ON COLUMN email_replies.source IS
  'Which pipe delivered this message: resend | outlook.';

-- ── email_sends ──────────────────────────────────────────────────────────
ALTER TABLE email_sends
  -- Who sent it. Campaign and automation mail has no human sender, so NULL
  -- there; one-to-one mail through Outlook always carries one.
  ADD COLUMN IF NOT EXISTS mailbox_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conversation_id TEXT,
  ADD COLUMN IF NOT EXISTS internet_message_id TEXT,
  ADD COLUMN IF NOT EXISTS graph_message_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'resend';

COMMENT ON COLUMN email_sends.mailbox_user_id IS
  'CRM user who sent this from their own mailbox. NULL = sent by campaign/automation via Resend.';

-- ── indexes ──────────────────────────────────────────────────────────────
-- Every one of these backs a query the mailbox screen runs on every paint, or
-- an RLS predicate (248). Without them the thread list seq-scans 2,415 sends
-- and grows worse with every message synced.
CREATE INDEX IF NOT EXISTS idx_email_replies_mailbox_user
  ON email_replies(mailbox_user_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_conversation
  ON email_replies(conversation_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_mailbox_user
  ON email_sends(mailbox_user_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_conversation
  ON email_sends(conversation_id);

-- Dedupe key for the Outlook ingest. Partial so the 2,415 existing Resend
-- rows (all NULL here) are excluded and cannot collide with each other.
-- Graph redelivers change notifications and the catch-up sweep re-reads the
-- same window on purpose, so the ingest MUST be idempotent or every missed
-- notification becomes a duplicate reply in the inbox.
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_replies_internet_message_id
  ON email_replies(internet_message_id)
  WHERE internet_message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_sends_internet_message_id
  ON email_sends(internet_message_id)
  WHERE internet_message_id IS NOT NULL;

-- ── backfill ─────────────────────────────────────────────────────────────
-- Today's 44 replies and 2,415 sends predate mailboxes. Once 248 scopes reads
-- by mailbox_user_id, anything left NULL becomes admin-only — which would
-- quietly REMOVE replies a recruiter can see today. So attribute the existing
-- rows to the owner of the deal (then the contact) they relate to.
--
-- Deliberately conservative: where no owner can be derived the row stays NULL
-- and admin-only. Better that a recruiter asks why they cannot see an old
-- reply than that one recruiter silently inherits another's mail.
-- deals carries BOTH deal_owner_id (the live column, written by every deal
-- creation path) and a legacy owner_id that is largely NULL — the same trap as
-- stage_id vs current_stage_id. COALESCE prefers the live one, so this works
-- whichever a given row happens to have populated. Reading owner_id alone
-- would have produced a backfill that looked like it ran and attributed almost
-- nothing.
UPDATE email_replies er
   SET mailbox_user_id = COALESCE(d.deal_owner_id, d.owner_id)
  FROM deals d
 WHERE er.deal_id = d.id
   AND er.mailbox_user_id IS NULL
   AND COALESCE(d.deal_owner_id, d.owner_id) IS NOT NULL;

UPDATE email_replies er
   SET mailbox_user_id = c.owner_id
  FROM contacts c
 WHERE er.contact_id = c.id
   AND er.mailbox_user_id IS NULL
   AND c.owner_id IS NOT NULL;

UPDATE email_sends es
   SET mailbox_user_id = c.owner_id
  FROM contacts c
 WHERE es.recipient_contact_id = c.id
   AND es.mailbox_user_id IS NULL
   AND c.owner_id IS NOT NULL;
