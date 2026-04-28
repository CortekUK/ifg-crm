-- Migration: tighten contacts INSERT — admin / super_admin only.
-- Migration 099 allowed recruiters to insert contacts (since they meet players
-- at events). Per product decision, contact creation is now admin-managed.
-- Recruiters can still update contacts they own (per existing 099 update policy).

DROP POLICY IF EXISTS "contacts_insert_policy" ON contacts;

CREATE POLICY "contacts_insert_policy"
  ON contacts FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
