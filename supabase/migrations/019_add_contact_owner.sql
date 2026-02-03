-- Add owner_id column to contacts table
-- This allows assigning an owner (recruiter) to each contact/player

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id);

-- Create index for faster lookups by owner
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner_id);

-- Add comment for documentation
COMMENT ON COLUMN contacts.owner_id IS 'The user/recruiter assigned to this contact';
