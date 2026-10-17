-- Remove the test mail from the Outlook mailbox.
--
-- 23 threads, 12 replies, 14 sends — everything in the
-- superadmin@theinternationalfootballgroup.com mailbox (the crmtest
-- connection) except four genuine messages, kept deliberately:
--   donotreply@godaddy.com  sign-in alerts (3)
--   no-reply-aws@amazon.com SES verification (1)
-- Those arrived at a real mailbox and are already hidden as 'vendor', so
-- they cost nothing on screen and deleting real mail to tidy up is not a
-- trade worth making.
--
-- What goes:
--   1. demo-script seed rows (hamna+testing*), from demo-outlook-thread.mjs
--      and demo-unmatched-emails.mjs
--   2. the ZZ probe emails from building the SES migration — delivery checks,
--      attachment and compose checks, reply-route probes, bounce/complaint
--      simulator threads
--   3. manual testing from the mianabubaka / mian443 gmail accounts
--
-- NOT TOUCHED: nathan@macclesfieldfc.com's 393 threads of real business mail,
-- including six QA-era notification threads, which are a separate decision.
-- Contacts are not touched either — deleting a thread leaves the person.
--
-- REVERSIBLE. Every row is copied into deleted_test_mail_261 as jsonb before
-- it goes, so this can be put back. Drop that table once you are happy.
--
-- Checked first: no reply outside this set hangs off one of these sends, so
-- the email_replies -> email_sends CASCADE takes nothing with it.

CREATE TABLE IF NOT EXISTS deleted_test_mail_261 (
  id          bigserial PRIMARY KEY,
  deleted_at  timestamptz NOT NULL DEFAULT now(),
  source_table text       NOT NULL,
  row_data    jsonb       NOT NULL
);

-- 1. Back up the threads, which define the set.
INSERT INTO deleted_test_mail_261 (source_table, row_data)
SELECT 'email_threads', to_jsonb(t)
FROM email_threads t
JOIN profiles p ON p.id = t.mailbox_user_id
WHERE p.email = 'superadmin@theinternationalfootballgroup.com'
  AND t.counterparty_email NOT IN ('donotreply@godaddy.com', 'no-reply-aws@amazon.com');

-- 2. Back up everything hanging off those conversations.
INSERT INTO deleted_test_mail_261 (source_table, row_data)
SELECT 'email_replies', to_jsonb(r) FROM email_replies r
WHERE r.conversation_id IN (
  SELECT row_data->>'conversation_id' FROM deleted_test_mail_261 WHERE source_table = 'email_threads'
);

INSERT INTO deleted_test_mail_261 (source_table, row_data)
SELECT 'email_sends', to_jsonb(s) FROM email_sends s
WHERE s.conversation_id IN (
  SELECT row_data->>'conversation_id' FROM deleted_test_mail_261 WHERE source_table = 'email_threads'
);

-- 3. Delete, children first so the cascade has nothing left to do.
DELETE FROM email_replies WHERE conversation_id IN (
  SELECT row_data->>'conversation_id' FROM deleted_test_mail_261 WHERE source_table = 'email_threads'
);

DELETE FROM email_sends WHERE conversation_id IN (
  SELECT row_data->>'conversation_id' FROM deleted_test_mail_261 WHERE source_table = 'email_threads'
);

DELETE FROM email_threads WHERE conversation_id IN (
  SELECT row_data->>'conversation_id' FROM deleted_test_mail_261 WHERE source_table = 'email_threads'
);
