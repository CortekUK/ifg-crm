-- Evaluate row-level-security helper functions once per query, not once per row.
--
-- Every policy on these tables calls is_admin() / get_user_role() / auth.uid()
-- directly, so Postgres treats the call as part of the per-row filter. Counting
-- the tags of 105k contacts therefore called is_admin() 352,164 times — and
-- is_admin() itself queries profiles. The aggregate behind the Tags page took
-- 30.4 seconds against an 8 second statement_timeout for the `authenticated`
-- role, so the request was cancelled and the page rendered "no tags". The Lists
-- page failed the same way over contact_lists.
--
-- Wrapping a call in a scalar subquery — (SELECT is_admin()) — makes the planner
-- hoist it into an InitPlan that runs once and is reused for every row. This is
-- the standard remedy for RLS at scale and the logic is identical: these helpers
-- are STABLE and take no arguments, so their value cannot vary between rows of
-- one query.
--
-- Policy semantics are deliberately unchanged. Each USING/WITH CHECK expression
-- below is the existing one with the helper calls wrapped, nothing more.

-- ── contacts ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "contacts_select_policy" ON contacts;
CREATE POLICY "contacts_select_policy" ON contacts FOR SELECT TO authenticated
  USING (
    (SELECT get_user_role()) = ANY (ARRAY['admin', 'super_admin'])
    OR (
      (SELECT get_user_role()) = 'recruiter'
      AND (
        owner_id = (SELECT auth.uid())
        OR id IN (SELECT contact_id FROM deals WHERE deal_owner_id = (SELECT auth.uid()))
      )
    )
    OR ((SELECT get_user_role()) = 'player' AND id = (SELECT get_player_contact_id()))
  );

DROP POLICY IF EXISTS "contacts_update_policy" ON contacts;
CREATE POLICY "contacts_update_policy" ON contacts FOR UPDATE TO authenticated
  USING (
    (SELECT get_user_role()) = ANY (ARRAY['admin', 'super_admin'])
    OR (
      (SELECT get_user_role()) = 'recruiter'
      AND (
        owner_id = (SELECT auth.uid())
        OR id IN (SELECT contact_id FROM deals WHERE deal_owner_id = (SELECT auth.uid()))
      )
    )
  )
  WITH CHECK (
    (SELECT get_user_role()) = ANY (ARRAY['admin', 'super_admin'])
    OR (
      (SELECT get_user_role()) = 'recruiter'
      AND (
        owner_id = (SELECT auth.uid())
        OR id IN (SELECT contact_id FROM deals WHERE deal_owner_id = (SELECT auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "contacts_delete_policy" ON contacts;
CREATE POLICY "contacts_delete_policy" ON contacts FOR DELETE TO authenticated
  USING ((SELECT get_user_role()) = ANY (ARRAY['admin', 'super_admin']));

DROP POLICY IF EXISTS "contacts_insert_policy" ON contacts;
CREATE POLICY "contacts_insert_policy" ON contacts FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin()));

-- ── contact_tags ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "contact_tags_select" ON contact_tags;
CREATE POLICY "contact_tags_select" ON contact_tags FOR SELECT TO authenticated
  USING ((SELECT is_admin()) OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_tags.contact_id));

DROP POLICY IF EXISTS "contact_tags_update" ON contact_tags;
CREATE POLICY "contact_tags_update" ON contact_tags FOR UPDATE TO authenticated
  USING ((SELECT is_admin()) OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_tags.contact_id));

DROP POLICY IF EXISTS "contact_tags_delete" ON contact_tags;
CREATE POLICY "contact_tags_delete" ON contact_tags FOR DELETE TO authenticated
  USING ((SELECT is_admin()) OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_tags.contact_id));

DROP POLICY IF EXISTS "contact_tags_insert" ON contact_tags;
CREATE POLICY "contact_tags_insert" ON contact_tags FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin()) OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_tags.contact_id));

-- ── contact_lists ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "contact_lists_select" ON contact_lists;
CREATE POLICY "contact_lists_select" ON contact_lists FOR SELECT TO authenticated
  USING ((SELECT is_admin()) OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_lists.contact_id));

DROP POLICY IF EXISTS "contact_lists_update" ON contact_lists;
CREATE POLICY "contact_lists_update" ON contact_lists FOR UPDATE TO authenticated
  USING ((SELECT is_admin()) OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_lists.contact_id));

DROP POLICY IF EXISTS "contact_lists_delete" ON contact_lists;
CREATE POLICY "contact_lists_delete" ON contact_lists FOR DELETE TO authenticated
  USING ((SELECT is_admin()) OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_lists.contact_id));

DROP POLICY IF EXISTS "contact_lists_insert" ON contact_lists;
CREATE POLICY "contact_lists_insert" ON contact_lists FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin()) OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_lists.contact_id));

-- ── lists / tags ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "lists_select" ON lists;
CREATE POLICY "lists_select" ON lists FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) <> 'player');

DROP POLICY IF EXISTS "lists_update" ON lists;
CREATE POLICY "lists_update" ON lists FOR UPDATE TO authenticated
  USING ((SELECT is_admin())) WITH CHECK ((SELECT is_admin()));

DROP POLICY IF EXISTS "lists_delete" ON lists;
CREATE POLICY "lists_delete" ON lists FOR DELETE TO authenticated
  USING ((SELECT is_admin()));

DROP POLICY IF EXISTS "lists_insert" ON lists;
CREATE POLICY "lists_insert" ON lists FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin()));

DROP POLICY IF EXISTS "tags_select" ON tags;
CREATE POLICY "tags_select" ON tags FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) <> 'player');

DROP POLICY IF EXISTS "tags_update" ON tags;
CREATE POLICY "tags_update" ON tags FOR UPDATE TO authenticated
  USING ((SELECT is_admin())) WITH CHECK ((SELECT is_admin()));

DROP POLICY IF EXISTS "tags_delete" ON tags;
CREATE POLICY "tags_delete" ON tags FOR DELETE TO authenticated
  USING ((SELECT is_admin()));

DROP POLICY IF EXISTS "tags_insert" ON tags;
CREATE POLICY "tags_insert" ON tags FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin()));
