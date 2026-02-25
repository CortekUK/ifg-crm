-- Custom field definitions for contacts
CREATE TABLE custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name TEXT NOT NULL UNIQUE,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'date', 'select', 'boolean')),
  options JSONB, -- For select type: ["option1", "option2"]
  is_required BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_custom_field_definitions_order ON custom_field_definitions(display_order);

-- RLS
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read custom field definitions" ON custom_field_definitions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage custom field definitions" ON custom_field_definitions
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );
