-- ============================================
-- Contact Notes - Timestamped note log for contacts
-- Each note is a separate entry with timestamp and author
-- ============================================

CREATE TABLE contact_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fetching notes by contact
CREATE INDEX idx_contact_notes_contact ON contact_notes(contact_id);
CREATE INDEX idx_contact_notes_created ON contact_notes(created_at DESC);

-- Migrate existing notes from contacts table to contact_notes
INSERT INTO contact_notes (contact_id, content, created_at)
SELECT id, notes, updated_at
FROM contacts
WHERE notes IS NOT NULL AND notes != '';

-- Enable RLS
ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view all contact notes"
  ON contact_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert contact notes"
  ON contact_notes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete their own notes"
  ON contact_notes FOR DELETE
  TO authenticated
  USING (created_by_id = auth.uid());

-- Comment on table
COMMENT ON TABLE contact_notes IS 'Timestamped notes log for contacts - each entry is a separate note';
