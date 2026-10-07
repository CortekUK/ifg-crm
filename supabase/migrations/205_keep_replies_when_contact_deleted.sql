-- QA-33 Bug 6: deleting a player deleted every reply they had ever sent.
--
-- email_replies.contact_id was ON DELETE CASCADE while every other foreign key
-- on the same table is SET NULL:
--
--   deal_id      -> SET NULL
--   pipeline_id  -> SET NULL
--   campaign_id  -> SET NULL
--   contact_id   -> CASCADE     <-- the odd one out
--
-- So removing one contact silently destroyed the inbound history attached to
-- them. That history is evidence — what a player actually said, and when — and
-- it is the one thing you cannot reconstruct. A contact can be deleted for
-- mundane reasons (a duplicate being merged away, a test record cleaned up)
-- and take real correspondence with it.
--
-- SET NULL keeps the reply and drops it back to "unmatched", which is exactly
-- the state the inbox already understands: contact_id is nullable, and every
-- reply from an address the CRM does not recognise already sits there. Staff
-- can re-match it by hand if the contact is recreated.
--
-- Idempotent: dropping by name and recreating.

ALTER TABLE email_replies
  DROP CONSTRAINT IF EXISTS email_replies_contact_id_fkey;

ALTER TABLE email_replies
  ADD CONSTRAINT email_replies_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
