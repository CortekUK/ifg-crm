-- QA-56 Issue 1: deleting a contact permanently wiped its invoices and payments.
--
-- invoices.contact_id and payments.contact_id were both ON DELETE CASCADE, so
-- removing one contact silently destroyed every invoice raised for them and
-- every payment they had made — including paid ones. That is the financial
-- record of money actually received, gone with no warning and no way back:
-- the totals on the Invoices and Payments pages, and every report built on
-- them, would quietly drop by whatever that person had paid.
--
-- Deleting a contact is a routine piece of housekeeping (QA test rows, a
-- duplicate import), which is exactly why it must not be able to do this.
--
-- Why RESTRICT and not SET NULL: both columns are NOT NULL, and the whole app
-- reads an invoice's contact without a null check — "an invoice belongs to
-- somebody" is an invariant, not an accident. Making it nullable to preserve
-- orphan rows would push a null into every invoice screen, report and PDF.
-- RESTRICT keeps the invariant and refuses the delete instead, which is the
-- honest answer: the money has to be dealt with before the person can go.
--
-- The caller (useBulkDeleteContacts) checks for these rows first and explains
-- what to do, so nobody meets a raw foreign-key error. This constraint is the
-- backstop for every other route to a delete.
--
-- Deliberately NOT changed: deals, portal_users and contact_lists stay
-- CASCADE. They describe a relationship with the person and are meaningless
-- without them. Money is not.
--
-- Idempotent.

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_contact_id_fkey;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE RESTRICT;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_contact_id_fkey;
ALTER TABLE payments
  ADD CONSTRAINT payments_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE RESTRICT;
