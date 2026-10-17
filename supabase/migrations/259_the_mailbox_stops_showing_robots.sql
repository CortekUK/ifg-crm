-- Hide automated mail from the Outlook mailbox.
--
-- The inbox had 244 unmatched threads and most of them were machines:
-- Calendly notifications, GoDaddy and AWS alerts, Exchange bounce reports,
-- mailer-daemon. A parent's reply sat between them.
--
-- 'vendor' joins 'internal' in HIDDEN_CATEGORIES (lib/outlook/classify-sender.ts),
-- so this is a DISPLAY filter, not a deletion: the threads stay, every trigger
-- that hangs off them still fires, and removing 'vendor' from that one array
-- brings them all back.
--
-- MIRRORS isVendorAddress() in lib/outlook/classify-sender.ts. New mail is
-- classified there on ingest; this is the one-off pass over what is already
-- stored. The patterns match on the LOCAL PART, not the domain — a domain
-- blocklist would have to chase calendly, zoom, southwest, brighthr, openai,
-- xero and whatever gets signed up for next, while these catch 104 threads
-- with nothing to maintain.
--
-- Deliberately narrow: admin@, accounts@, info@, training@, support@ and
-- theteam@ are left alone. They are shared human mailboxes, and at a football
-- club and a university they are exactly where a real conversation comes from.
-- Hiding a person is worse than leaving a robot on screen.
--
-- contact_id IS NULL is belt and braces. Nothing matching these patterns is
-- currently linked to a contact (checked: 104 matches, 0 with a contact), and
-- if that ever changes the person wins.

-- Both columns are constrained to a fixed set of kinds, so the new one has to
-- be allowed before anything can be written. The database refused the first
-- attempt at this migration, which is the constraint doing its job.

ALTER TABLE email_threads DROP CONSTRAINT IF EXISTS email_threads_category_check;
ALTER TABLE email_threads ADD CONSTRAINT email_threads_category_check
  CHECK (category = ANY (ARRAY['player','parent','secondary','internal','external','vendor','unknown']));

ALTER TABLE email_replies DROP CONSTRAINT IF EXISTS email_replies_sender_kind_check;
ALTER TABLE email_replies ADD CONSTRAINT email_replies_sender_kind_check
  CHECK (sender_kind = ANY (ARRAY['player','parent','secondary','internal','external','vendor','unknown']));

UPDATE email_threads
SET category = 'vendor'
WHERE contact_id IS NULL
  AND category IN ('unknown', 'external')
  AND (
    lower(split_part(counterparty_email, '@', 1)) ~
      '^(no[-_.]?reply|do[-_.]?not[-_.]?reply|mailer[-_]?daemon$|postmaster$|notifications?([-_.]|$)|bounces?([-_.]|$)|automated|auto[-_]?reply|auto[-_]?confirm|messaging[-_]service$|microsoftexchange[0-9a-f]{16,}$)'
    OR lower(split_part(counterparty_email, '@', 2)) IN
      ('ccsend.com','amazonses.com','sendgrid.net','mailchimp.com','mcsv.net','rsgsv.net','sparkpostmail.com','mandrillapp.com')
    OR lower(split_part(counterparty_email, '@', 2)) LIKE '%.ccsend.com'
    OR lower(split_part(counterparty_email, '@', 2)) LIKE '%.amazonses.com'
  );

-- The per-message tag, so an opened thread agrees with the folder it came from.
UPDATE email_replies
SET sender_kind = 'vendor'
WHERE contact_id IS NULL
  AND (sender_kind IS NULL OR sender_kind IN ('unknown', 'external'))
  AND (
    lower(split_part(from_email, '@', 1)) ~
      '^(no[-_.]?reply|do[-_.]?not[-_.]?reply|mailer[-_]?daemon$|postmaster$|notifications?([-_.]|$)|bounces?([-_.]|$)|automated|auto[-_]?reply|auto[-_]?confirm|messaging[-_]service$|microsoftexchange[0-9a-f]{16,}$)'
    OR lower(split_part(from_email, '@', 2)) IN
      ('ccsend.com','amazonses.com','sendgrid.net','mailchimp.com','mcsv.net','rsgsv.net','sparkpostmail.com','mandrillapp.com')
    OR lower(split_part(from_email, '@', 2)) LIKE '%.ccsend.com'
    OR lower(split_part(from_email, '@', 2)) LIKE '%.amazonses.com'
  );
