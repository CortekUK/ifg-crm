-- Migration: deduplicate email_replies by RFC Message-Id and prevent future
-- duplicates at the DB level.
--
-- Background: the inbound webhook used a bare INSERT, so when Resend retried
-- delivery (after our fix to JWT/secret it replayed previously-failed events)
-- we got a brand-new row per retry for the same email. The user saw "this
-- mail is showing 2 times in my replies".
--
-- Fix:
--   1. Collapse existing duplicates — keep the oldest row per message_id, drop
--      the rest. Oldest is preferred because it carries any manual matches /
--      spam markings made before the retry hit.
--   2. Add a partial unique index on message_id (where it's not null) so the
--      webhook can use upsert + ignoreDuplicates and Resend retries become
--      idempotent at the DB level.

-- 1. Remove duplicates, keeping the oldest by created_at.
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY message_id ORDER BY created_at ASC) AS rn
  FROM email_replies
  WHERE message_id IS NOT NULL
)
DELETE FROM email_replies
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2. Enforce uniqueness going forward.
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_replies_message_id
ON email_replies (message_id)
WHERE message_id IS NOT NULL;
