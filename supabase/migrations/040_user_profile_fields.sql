-- Add new profile fields for users
-- Title, Zoom URL, and Pipeline Assignments

-- Add title column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS title text;

-- Add zoom_url column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS zoom_url text;

-- Add pipeline_assignments column to profiles (array of pipeline IDs)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS pipeline_assignments uuid[] DEFAULT '{}';

-- Add new fields to user_invites table
ALTER TABLE user_invites
ADD COLUMN IF NOT EXISTS title text;

ALTER TABLE user_invites
ADD COLUMN IF NOT EXISTS zoom_url text;

ALTER TABLE user_invites
ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE user_invites
ADD COLUMN IF NOT EXISTS pipeline_ids uuid[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN profiles.title IS 'Job title for display and email signatures';
COMMENT ON COLUMN profiles.zoom_url IS 'Personal Zoom meeting link for templates';
COMMENT ON COLUMN profiles.pipeline_assignments IS 'Array of pipeline IDs the user is assigned to for round-robin';
COMMENT ON COLUMN user_invites.pipeline_ids IS 'Array of pipeline IDs to assign when invite is accepted';
