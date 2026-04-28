-- Migration: scope pipelines and pipeline_stages by role.
-- Today both tables have the legacy "Allow authenticated full access" blanket
-- policy plus a player-specific SELECT layered in 079. Recruiters can see
-- every pipeline regardless of assignment.
-- New rules:
--   - admin / super_admin: full access (unchanged behaviour).
--   - recruiter: SELECT only pipelines listed in their profiles.pipeline_assignments
--     OR pipelines they own at least one deal in. Cannot create/edit/delete pipelines.
--   - player: SELECT any pipeline (existing 079 rule kept; players need stage
--     names to render their own deals).
-- Service-role calls (webhooks, edge functions, cron) bypass RLS.

-- 1. Drop blanket policies and the existing player overrides.
DROP POLICY IF EXISTS "Allow authenticated full access" ON pipelines;
DROP POLICY IF EXISTS "Allow authenticated full access" ON pipeline_stages;
DROP POLICY IF EXISTS "Players can view pipelines" ON pipelines;
DROP POLICY IF EXISTS "Players can view pipeline stages" ON pipeline_stages;

-- Helper: returns the assigned pipeline ids for the current user, or empty.
CREATE OR REPLACE FUNCTION public.get_assigned_pipeline_ids()
RETURNS UUID[] AS $$
  SELECT COALESCE(pipeline_assignments, ARRAY[]::UUID[])
    FROM public.profiles
   WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_assigned_pipeline_ids() TO authenticated;

-- 2. PIPELINES — SELECT
CREATE POLICY "pipelines_select_policy"
  ON pipelines FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('admin', 'super_admin')
    OR (
      public.get_user_role() = 'recruiter'
      AND (
        id = ANY(public.get_assigned_pipeline_ids())
        OR id IN (SELECT pipeline_id FROM deals WHERE deal_owner_id = auth.uid())
      )
    )
    OR public.get_user_role() = 'player'
  );

-- 3. PIPELINES — INSERT / UPDATE / DELETE: admin/super_admin only.
CREATE POLICY "pipelines_insert_policy"
  ON pipelines FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "pipelines_update_policy"
  ON pipelines FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('admin', 'super_admin'))
  WITH CHECK (public.get_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "pipelines_delete_policy"
  ON pipelines FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('admin', 'super_admin'));

-- 4. PIPELINE_STAGES — SELECT mirrors the parent pipeline visibility.
CREATE POLICY "pipeline_stages_select_policy"
  ON pipeline_stages FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('admin', 'super_admin')
    OR (
      public.get_user_role() = 'recruiter'
      AND pipeline_id IN (
        SELECT id FROM pipelines
         WHERE id = ANY(public.get_assigned_pipeline_ids())
            OR id IN (SELECT pipeline_id FROM deals WHERE deal_owner_id = auth.uid())
      )
    )
    OR public.get_user_role() = 'player'
  );

-- 5. PIPELINE_STAGES — INSERT / UPDATE / DELETE: admin/super_admin only.
CREATE POLICY "pipeline_stages_insert_policy"
  ON pipeline_stages FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "pipeline_stages_update_policy"
  ON pipeline_stages FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('admin', 'super_admin'))
  WITH CHECK (public.get_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "pipeline_stages_delete_policy"
  ON pipeline_stages FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('admin', 'super_admin'));
