-- Add description column to tags
ALTER TABLE tags ADD COLUMN IF NOT EXISTS description text;

-- Expand category check constraint to include 'location' and 'source'
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_category_check;
ALTER TABLE tags ADD CONSTRAINT tags_category_check
  CHECK (category IN ('tournament', 'skill', 'priority', 'location', 'source', 'other'));
