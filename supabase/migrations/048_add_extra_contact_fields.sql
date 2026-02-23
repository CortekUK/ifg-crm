ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS football_background TEXT,
  ADD COLUMN IF NOT EXISTS academic_background TEXT,
  ADD COLUMN IF NOT EXISTS degree_choice TEXT,
  ADD COLUMN IF NOT EXISTS football_highlights TEXT,
  ADD COLUMN IF NOT EXISTS preferred_programme TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';
