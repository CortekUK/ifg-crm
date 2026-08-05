-- Portal / RLS hardening.
--
-- Several policies were `USING (true)` for all authenticated users, so a
-- logged-in PLAYER (an external recruit/parent) could read — and in some cases
-- modify — data belonging to everyone. Staff (admin/recruiter) behaviour is
-- intentionally left unchanged; these changes only restrict players.
--
--   1. deals:   a blanket `true` SELECT/UPDATE/INSERT exposed EVERY deal to any
--               authenticated user, defeating the "Players can view own deals"
--               policy (policies are OR'd). Drop the blanket SELECT (the
--               role-aware one already covers staff+players) and restrict
--               write to non-players.
--   2. deal_activities: auto-scoped once deals SELECT is player-aware (its
--               policy is EXISTS over deals), so no change needed here.
--   3. profiles: SELECT `true` leaked every user's PII. Players now read only
--               their own profile (all portal reads are `id = auth.uid()`).
--   4. invoices: players could UPDATE/INSERT their own invoice. Restrict write
--               to admins + recruiters (players keep read via invoices_select).
--   5. lists/tags: SELECT `true` leaked all list/tag names to players.

-- 1. deals ------------------------------------------------------------------
DROP POLICY IF EXISTS deals_select_policy ON public.deals;  -- was USING (true)

DROP POLICY IF EXISTS deals_update_policy ON public.deals;
CREATE POLICY deals_update_policy ON public.deals
  FOR UPDATE TO authenticated
  USING (get_user_role() <> 'player')
  WITH CHECK (get_user_role() <> 'player');

DROP POLICY IF EXISTS deals_insert_policy ON public.deals;
CREATE POLICY deals_insert_policy ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() <> 'player');

-- 3. profiles ---------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated read" ON public.profiles;
CREATE POLICY "Allow authenticated read" ON public.profiles
  FOR SELECT TO authenticated
  USING ((get_user_role() <> 'player') OR (id = auth.uid()));

DROP POLICY IF EXISTS "Allow authenticated insert" ON public.profiles;
CREATE POLICY "Allow authenticated insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((id = auth.uid()) OR is_admin());

-- 4. invoices ---------------------------------------------------------------
DROP POLICY IF EXISTS invoices_update ON public.invoices;
CREATE POLICY invoices_update ON public.invoices
  FOR UPDATE TO authenticated
  USING (is_admin() OR (get_user_role() = 'recruiter' AND contact_id IS NOT NULL AND contact_id IN (SELECT id FROM contacts)))
  WITH CHECK (is_admin() OR (get_user_role() = 'recruiter' AND contact_id IS NOT NULL AND contact_id IN (SELECT id FROM contacts)));

DROP POLICY IF EXISTS invoices_insert ON public.invoices;
CREATE POLICY invoices_insert ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR (get_user_role() = 'recruiter' AND contact_id IS NOT NULL AND contact_id IN (SELECT id FROM contacts)));

-- 5. lists / tags -----------------------------------------------------------
DROP POLICY IF EXISTS lists_select ON public.lists;
CREATE POLICY lists_select ON public.lists
  FOR SELECT TO authenticated
  USING (get_user_role() <> 'player');

DROP POLICY IF EXISTS tags_select ON public.tags;
CREATE POLICY tags_select ON public.tags
  FOR SELECT TO authenticated
  USING (get_user_role() <> 'player');
