-- Widen what a recruiter can reach.
--
-- Recruiters were scoped to the players they personally owned: contacts they
-- owned or held a deal for, and only the pipelines in their
-- profiles.pipeline_assignments. Per product decision they now work across the
-- whole book — every contact, every pipeline, plus lists and tags — while the
-- destructive and bulk-extraction actions stay with admins.
--
-- The line is: recruiters CREATE and EDIT, admins DELETE.
--   contacts   SELECT ✓  INSERT ✓  UPDATE ✓  DELETE ✗   (export is blocked in the UI)
--   pipelines  SELECT ✓  INSERT ✗  UPDATE ✗  DELETE ✗
--   lists      SELECT ✓  INSERT ✓  UPDATE ✓  DELETE ✗
--   tags       SELECT ✓  INSERT ✓  UPDATE ✓  DELETE ✗
--
-- This reverses 102 (contacts INSERT admin-only) and the visibility half of
-- 099 and 100. Their DELETE rules are deliberately left alone.
--
-- profiles.pipeline_assignments is NOT removed — it still drives round-robin
-- lead assignment. It simply no longer decides what a recruiter can see.
--
-- Helper calls are wrapped in a scalar subquery, per 160: it makes the planner
-- run them once per query instead of once per row, which is the difference
-- between a fast Contacts page and a statement timeout over 105k rows.

-- Staff = anyone who works here, as opposed to a player using the portal.
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
  SELECT public.get_user_role() IN ('admin', 'super_admin', 'recruiter')
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- ── contacts ─────────────────────────────────────────────────────────────
-- Staff see and edit every contact. Players keep their own record only.
DROP POLICY IF EXISTS "contacts_select_policy" ON contacts;
CREATE POLICY "contacts_select_policy" ON contacts FOR SELECT TO authenticated
  USING (
    (SELECT is_staff())
    OR ((SELECT get_user_role()) = 'player' AND id = (SELECT get_player_contact_id()))
  );

DROP POLICY IF EXISTS "contacts_update_policy" ON contacts;
CREATE POLICY "contacts_update_policy" ON contacts FOR UPDATE TO authenticated
  USING ((SELECT is_staff()))
  WITH CHECK ((SELECT is_staff()));

DROP POLICY IF EXISTS "contacts_insert_policy" ON contacts;
CREATE POLICY "contacts_insert_policy" ON contacts FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_staff()));

-- contacts_delete_policy is intentionally untouched: admin / super_admin only.

-- ── pipelines ────────────────────────────────────────────────────────────
-- Everyone signed in can read the pipeline structure; only admins change it.
DROP POLICY IF EXISTS "pipelines_select_policy" ON pipelines;
CREATE POLICY "pipelines_select_policy" ON pipelines FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "pipeline_stages_select_policy" ON pipeline_stages;
CREATE POLICY "pipeline_stages_select_policy" ON pipeline_stages FOR SELECT TO authenticated
  USING (true);

-- ── lists ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS lists_insert ON lists;
CREATE POLICY lists_insert ON lists FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_staff()));

DROP POLICY IF EXISTS lists_update ON lists;
CREATE POLICY lists_update ON lists FOR UPDATE TO authenticated
  USING ((SELECT is_staff()))
  WITH CHECK ((SELECT is_staff()));

-- lists_delete stays admin-only.

-- ── tags ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS tags_insert ON tags;
CREATE POLICY tags_insert ON tags FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_staff()));

DROP POLICY IF EXISTS tags_update ON tags;
CREATE POLICY tags_update ON tags FOR UPDATE TO authenticated
  USING ((SELECT is_staff()))
  WITH CHECK ((SELECT is_staff()));

-- tags_delete stays admin-only.
