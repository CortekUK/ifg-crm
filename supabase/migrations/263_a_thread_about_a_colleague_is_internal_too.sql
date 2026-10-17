-- Two threads left over from 262.
--
-- 262 reclassified by the address a thread is WITH. These two are with someone
-- outside — Callum at the web agency, on the Cloudflare DNS thread — but are
-- linked to Lindsay's contact record, so they stayed 'player' and stayed on
-- screen among the players.
--
-- A thread attached to a colleague is a colleague's thread, whoever else is
-- copied in. Category only ever widens at ingest, which is right for contacts
-- and is exactly what pinned these two.
--
-- Recorded in the same table as 262 so both are undone together.

INSERT INTO reclassified_internal_262 (source_table, row_id, previous_value)
SELECT 'email_threads', t.id, t.category
FROM email_threads t
JOIN contacts c ON c.id = t.contact_id
WHERE t.category <> 'internal' AND public.is_staff_email(c.email);

UPDATE email_threads t
SET category = 'internal'
FROM contacts c
WHERE c.id = t.contact_id
  AND t.category <> 'internal'
  AND public.is_staff_email(c.email);
