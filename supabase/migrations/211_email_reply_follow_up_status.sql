-- QA-33 bug 4 — follow_up_status existed and nothing ever used it.
--
-- The column has been on email_replies since the schema was written, and
-- EmailFollowUpStatus in lib/types/email.ts has declared its three values just
-- as long, but no screen read it and nothing wrote it: 37 of 37 rows are NULL.
-- So there was no way to record that a reply had been dealt with, and a
-- recruiter working the inbox had to remember.
--
-- The Replies detail sheet now sets it. Adding the CHECK at the same time
-- because the column never had one — ai_intent and match_status both do, and
-- without it a typo in any future caller would be stored silently and then
-- render as a missing label.
--
-- NULL stays allowed and means "nobody has set one", which the UI reads as
-- Open. Backfilling 'open' over every existing row would claim a decision had
-- been made about replies nobody has looked at.

ALTER TABLE email_replies
  DROP CONSTRAINT IF EXISTS email_replies_follow_up_status_check;

ALTER TABLE email_replies
  ADD CONSTRAINT email_replies_follow_up_status_check
  CHECK (follow_up_status IS NULL
         OR follow_up_status IN ('open', 'in_progress', 'completed'));
