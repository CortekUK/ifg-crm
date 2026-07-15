-- Allow the website-originated contact sources so leads captured by the deposit
-- checkout, chatbot, exit-intent popup and university enquiry can be told apart
-- in the CRM (instead of all being lumped in as 'website_form').
--
-- Purely additive: re-creates contacts_source_check with the existing allowed
-- values (migration 029) plus the four website_* values.

ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_source_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_source_check
  CHECK (source IN (
    'website_form',
    'sms_reply',
    'email_reply',
    'manual',
    'csv_import',
    'referral',
    'google_ads',
    'instagram',
    'facebook',
    'email_campaign',
    'event',
    'website_deposit',
    'website_chatbot',
    'website_exit_intent',
    'website_university'
  ));
