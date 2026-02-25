-- Starred/favourite items table
CREATE TABLE starred_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'deal')),
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, entity_type, entity_id)
);

CREATE INDEX idx_starred_items_user ON starred_items(user_id);
CREATE INDEX idx_starred_items_entity ON starred_items(entity_type, entity_id);

-- RLS
ALTER TABLE starred_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own starred items" ON starred_items
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own starred items" ON starred_items
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own starred items" ON starred_items
  FOR DELETE TO authenticated USING (user_id = auth.uid());
