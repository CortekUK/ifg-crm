-- Fix contacts table constraints to match UI options

-- 1. Drop and recreate source constraint with more options
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
    'event'
  ));

-- 2. Fix subscription_status constraint (UI uses 'subscribed' not 'active')
-- First drop the constraint
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_subscription_status_check;

-- Update any 'active' values to 'subscribed'
UPDATE contacts SET subscription_status = 'subscribed' WHERE subscription_status = 'active';

-- Add the new constraint
ALTER TABLE contacts ADD CONSTRAINT contacts_subscription_status_check
  CHECK (subscription_status IN ('subscribed', 'unsubscribed'));
