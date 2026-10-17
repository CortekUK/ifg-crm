-- Put the Calendly booking notifications back in the mailbox.
--
-- Migration 259 hid everything sending from a notifications@ address, which
-- swept up notifications@calendly.com — 46 threads, each one a booked call.
--
-- That is the only place a booking appears in the CRM. calendly_events holds
-- ZERO rows, so the webhook meant to carry bookings in is delivering nothing,
-- and these emails are what the team has instead. Tidying the inbox is not
-- worth taking away the sight of a booked call.
--
-- Mirrors VENDOR_EXCEPT_DOMAINS in lib/outlook/classify-sender.ts.
--
-- Back to 'unknown', the category they held before 259 — not to a contact
-- category, because nothing about them has been matched to anyone.

UPDATE email_threads
SET category = 'unknown'
WHERE category = 'vendor'
  AND (lower(split_part(counterparty_email, '@', 2)) = 'calendly.com'
       OR lower(split_part(counterparty_email, '@', 2)) LIKE '%.calendly.com');

UPDATE email_replies
SET sender_kind = 'unknown'
WHERE sender_kind = 'vendor'
  AND (lower(split_part(from_email, '@', 2)) = 'calendly.com'
       OR lower(split_part(from_email, '@', 2)) LIKE '%.calendly.com');
