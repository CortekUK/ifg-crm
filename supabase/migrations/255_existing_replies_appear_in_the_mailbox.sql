-- Migration 255: give the mail that already exists a thread.
--
-- The mailbox screen lists email_threads. Every reply the CRM holds arrived
-- through Resend, long before threading existed, so none of them carries a
-- conversation_id and none has a thread row. The result: the old Replies
-- screen shows 26 replies and the new mailbox shows an empty Inbox.
--
-- That is not a missing feature, it is missing data. This backfills it:
-- one thread per existing reply, classified the same way the live ingest
-- classifies new mail, so Matched / Unmatched / Internal / External are
-- populated from day one rather than only for mail that arrives after an
-- Outlook mailbox is connected.
--
-- Idempotent: threads are keyed on conversation_id + mailbox_user_id and
-- skipped where one already exists, so re-running changes nothing.

-- Give every reply a conversation to belong to. Replies that answer the same
-- outbound send share its id, so a real exchange stays one conversation
-- instead of becoming two unrelated rows.
UPDATE email_replies
   SET conversation_id = COALESCE('legacy-send-' || email_send_id::text, 'legacy-reply-' || id::text)
 WHERE conversation_id IS NULL;

UPDATE email_sends
   SET conversation_id = 'legacy-send-' || id::text
 WHERE conversation_id IS NULL
   AND id IN (SELECT email_send_id FROM email_replies WHERE email_send_id IS NOT NULL);

-- Classify each sender with the same rules the ingest uses: our own staff are
-- internal, a known address is player/parent/secondary, anything else is still
-- waiting to be connected.
UPDATE email_replies er
   SET sender_kind = CASE
         WHEN public.is_staff_email(er.from_email) THEN 'internal'
         ELSE COALESCE((SELECT r.match_kind FROM public.resolve_contact_by_email(er.from_email) r), 'unknown')
       END
 WHERE er.sender_kind = 'unknown';

-- One thread per conversation, owned by the mailbox the reply was attributed
-- to in migration 245.
INSERT INTO email_threads (
  conversation_id, mailbox_user_id, subject, last_message_at, last_message_preview,
  last_message_from, last_message_direction, unread_count, message_count,
  contact_id, deal_id, pipeline_id, counterparty_email, counterparty_name,
  is_crm_related, category, latest_intent, participants, source
)
SELECT
  t.conversation_id,
  t.mailbox_user_id,
  t.subject,
  t.last_at,
  t.preview,
  t.from_email,
  'inbound',
  t.unread,
  t.messages,
  t.contact_id,
  t.deal_id,
  t.pipeline_id,
  t.from_email,
  t.from_name,
  t.contact_id IS NOT NULL,
  t.category,
  t.intent,
  '[]'::jsonb,
  'resend'
FROM (
  SELECT
    er.conversation_id,
    er.mailbox_user_id,
    (ARRAY_AGG(er.subject      ORDER BY er.received_at DESC NULLS LAST))[1] AS subject,
    MAX(COALESCE(er.received_at, er.created_at))                            AS last_at,
    (ARRAY_AGG(er.body_preview ORDER BY er.received_at DESC NULLS LAST))[1] AS preview,
    (ARRAY_AGG(er.from_email   ORDER BY er.received_at DESC NULLS LAST))[1] AS from_email,
    (ARRAY_AGG(er.from_name    ORDER BY er.received_at DESC NULLS LAST))[1] AS from_name,
    (ARRAY_AGG(er.ai_intent    ORDER BY er.received_at DESC NULLS LAST))[1] AS intent,
    (ARRAY_AGG(er.contact_id   ORDER BY er.received_at DESC NULLS LAST))[1] AS contact_id,
    (ARRAY_AGG(er.deal_id      ORDER BY er.received_at DESC NULLS LAST))[1] AS deal_id,
    (ARRAY_AGG(er.pipeline_id  ORDER BY er.received_at DESC NULLS LAST))[1] AS pipeline_id,
    (ARRAY_AGG(er.sender_kind  ORDER BY er.received_at DESC NULLS LAST))[1] AS category,
    COUNT(*)::int                                                           AS messages,
    COUNT(*) FILTER (WHERE COALESCE(er.read, false) = false)::int           AS unread
  FROM email_replies er
  WHERE er.conversation_id IS NOT NULL
  GROUP BY er.conversation_id, er.mailbox_user_id
) t
ON CONFLICT (conversation_id, mailbox_user_id) DO NOTHING;
