-- Deleting contacts timed out. The cause was one missing functional index.
--
-- The chain:
--   DELETE a contact
--     -> email_sends.recipient_contact_id is ON DELETE SET NULL, so those
--        rows are UPDATEd
--       -> that fires the BEFORE UPDATE trigger fill_email_send_contact(),
--          which re-links a send to a contact by address:
--
--            SELECT c.id FROM contacts c
--            WHERE lower(c.email) = lower(NEW.recipient_email)
--
-- contacts has three indexes on email — a unique one, a plain one and a trigram
-- one — and not one of them can serve lower(email). An expression is only
-- indexable by an index on that same expression. So the lookup was a
-- sequential scan of all 181,663 contacts, measured at 37ms, repeated once per
-- affected row: 935ms to delete a single contact, against a statement timeout
-- of a few seconds. Selecting a dozen contacts and pressing Delete could not
-- finish, and the UI reported only "Failed to delete contacts".
--
-- The same trigger runs on INSERT into email_sends whenever the caller did not
-- already know the contact id, so this scan was also being paid on ordinary
-- sending, not just deletes.
--
-- Not unique: contacts_email_key already enforces uniqueness on the raw
-- address, and asserting it again case-insensitively could fail outright on
-- existing rows that differ only by case.

CREATE INDEX IF NOT EXISTS idx_contacts_lower_email
  ON public.contacts (lower(email));

ANALYZE public.contacts;
