-- ============================================
-- Separate Email and SMS Subscription Status
-- Per requirements: "Unsubscribing from SMS must NOT unsubscribe from email, and vice versa"
-- ============================================

-- Add separate boolean fields for email and SMS subscription
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS email_subscribed BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS sms_subscribed BOOLEAN NOT NULL DEFAULT true;

-- Migrate existing data: if subscription_status is 'unsubscribed', set both to false
UPDATE contacts
SET email_subscribed = false, sms_subscribed = false
WHERE subscription_status = 'unsubscribed';

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_contacts_email_subscribed ON contacts(email_subscribed);
CREATE INDEX IF NOT EXISTS idx_contacts_sms_subscribed ON contacts(sms_subscribed);

-- Add comment explaining the fields
COMMENT ON COLUMN contacts.email_subscribed IS 'Whether the contact is subscribed to email communications';
COMMENT ON COLUMN contacts.sms_subscribed IS 'Whether the contact is subscribed to SMS communications';

-- Note: We keep subscription_status for backwards compatibility but new code should use the separate fields
