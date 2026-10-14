-- Migration 250: allow 'outlook_compose' as a contact source.
--
-- Composing a message to an address the CRM has never seen now records that
-- person as a contact at the moment we email them — otherwise the mail goes
-- out and the person is immediately lost: no record, no deal, and nothing for
-- their reply to match against when it comes back.
--
-- contacts.source carries a CHECK constraint listing every permitted value,
-- so the insert fails outright unless the new one is added here. Writing the
-- contact as 'manual' instead would have worked, but it would also have made
-- the dashboard's lead-source breakdown quietly wrong — compose-originated
-- leads are not the same thing as a record somebody typed in by hand, and
-- that distinction is the whole point of the field.
--
-- Additive only: every existing value stays permitted and no row changes.

ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_source_check;

ALTER TABLE contacts ADD CONSTRAINT contacts_source_check CHECK (
  source = ANY (ARRAY[
    'website_form'::text,
    'sms_reply'::text,          -- retained: historical rows still carry it
    'email_reply'::text,
    'manual'::text,
    'csv_import'::text,
    'referral'::text,
    'google_ads'::text,
    'instagram'::text,
    'facebook'::text,
    'email_campaign'::text,
    'event'::text,
    'website_deposit'::text,
    'website_chatbot'::text,
    'website_exit_intent'::text,
    'website_university'::text,
    'website_brochure'::text,
    'outlook_compose'::text     -- new: emailed from the CRM mailbox
  ])
);

COMMENT ON CONSTRAINT contacts_source_check ON contacts IS
  'Permitted lead sources. outlook_compose = created because a recruiter emailed this address from the CRM mailbox.';
