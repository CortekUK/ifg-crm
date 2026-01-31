-- ============================================
-- Lists Management Feature
-- ============================================

-- Note: The "lists" and "contact_lists" tables already exist from the initial schema.
-- This migration adds seed data for default lists.

-- ============================================
-- SEED DEFAULT LISTS
-- ============================================

-- System lists (ALL contacts)
INSERT INTO lists (id, name, description, sport, is_dynamic, created_at, updated_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'ALL CONTACTS - EVERYONE', 'All contacts in the system regardless of gender or graduation year', 'football', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'ALL BOYS', 'All male contacts', 'football', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', 'ALL GIRLS', 'All female contacts', 'football', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Men's Lead Lists by Year
INSERT INTO lists (id, name, description, sport, is_dynamic, created_at, updated_at) VALUES
  ('00000000-0000-0000-0000-000000000010', '2024 Men''s Lead', 'Male leads graduating in 2024', 'football', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000011', '2025 Men''s Lead', 'Male leads graduating in 2025', 'football', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000012', '2026 Men''s Lead', 'Male leads graduating in 2026', 'football', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000013', '2027 Men''s Lead', 'Male leads graduating in 2027', 'football', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000014', '2028 Men''s Lead', 'Male leads graduating in 2028', 'football', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000015', '2029 Men''s Lead', 'Male leads graduating in 2029', 'football', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Women's Lead Lists by Year
INSERT INTO lists (id, name, description, sport, is_dynamic, created_at, updated_at) VALUES
  ('00000000-0000-0000-0000-000000000020', '2024 Women''s Lead', 'Female leads graduating in 2024', 'football', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000021', '2025 Women''s Lead', 'Female leads graduating in 2025', 'football', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000022', '2026 Women''s Lead', 'Female leads graduating in 2026', 'football', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000023', '2027 Women''s Lead', 'Female leads graduating in 2027', 'football', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000024', '2028 Women''s Lead', 'Female leads graduating in 2028', 'football', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000025', '2029 Women''s Lead', 'Female leads graduating in 2029', 'football', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Additional indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_lists_name ON lists(name);
CREATE INDEX IF NOT EXISTS idx_lists_is_dynamic ON lists(is_dynamic);
CREATE INDEX IF NOT EXISTS idx_contact_lists_added_at ON contact_lists(added_at DESC);
