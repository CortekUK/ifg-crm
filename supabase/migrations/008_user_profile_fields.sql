-- Migration: Add user profile fields for email personalisation
-- Adds calendly_url, phone, and email_signature to profiles table

-- Add new columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS calendly_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_signature TEXT;

-- Add comments for documentation
COMMENT ON COLUMN profiles.calendly_url IS 'Calendly scheduling URL for the user';
COMMENT ON COLUMN profiles.phone IS 'Phone number for the user';
COMMENT ON COLUMN profiles.email_signature IS 'HTML email signature for the user';

-- Create index for users with calendly URLs (for quick lookup)
CREATE INDEX IF NOT EXISTS idx_profiles_calendly_url ON profiles(calendly_url) WHERE calendly_url IS NOT NULL;
