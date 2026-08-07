-- Align deals UPDATE RLS with the app's own edit rule.
--
-- deals SELECT is intentionally broad (recruiters view the whole pipeline), but
-- UPDATE was `get_user_role() <> 'player'`, so any recruiter could modify or
-- reassign ANY deal via a direct API call — looser than the UI's
-- `canMoveDeal = isAdmin || own`. Restrict edits to the deal's owner (or an
-- admin). The WITH CHECK also stops a recruiter reassigning a deal away from
-- themselves. Service-role automations bypass RLS, so deal creation/pipeline
-- moves by the system are unaffected.

DROP POLICY IF EXISTS deals_update_policy ON public.deals;
CREATE POLICY deals_update_policy ON public.deals
  FOR UPDATE TO authenticated
  USING (is_admin() OR deal_owner_id = auth.uid())
  WITH CHECK (is_admin() OR deal_owner_id = auth.uid());
