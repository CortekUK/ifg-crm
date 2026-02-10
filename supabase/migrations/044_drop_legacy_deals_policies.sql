-- Fix deals RLS: enable it and drop legacy catch-all policies
-- RLS was never actually enabled on the deals table, and two catch-all policies
-- ("Allow all for authenticated", "Allow public read") bypassed the ownership
-- policies from migration 026.

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON deals;
DROP POLICY IF EXISTS "Allow public read" ON deals;
