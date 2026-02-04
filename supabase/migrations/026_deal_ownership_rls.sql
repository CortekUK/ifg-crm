-- Deal Ownership RLS Policies
-- Recruiters can only see/modify deals assigned to them
-- Admins and super_admins can see/modify all deals

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

-- DEALS TABLE POLICIES
DROP POLICY IF EXISTS "Allow authenticated full access" ON deals;

CREATE POLICY "deals_select_policy" ON deals
FOR SELECT TO authenticated
USING (
  public.get_user_role() IN ('admin', 'super_admin')
  OR deal_owner_id = auth.uid()
);

CREATE POLICY "deals_insert_policy" ON deals
FOR INSERT TO authenticated
WITH CHECK (
  public.get_user_role() IN ('admin', 'super_admin')
  OR deal_owner_id = auth.uid()
);

CREATE POLICY "deals_update_policy" ON deals
FOR UPDATE TO authenticated
USING (
  public.get_user_role() IN ('admin', 'super_admin')
  OR deal_owner_id = auth.uid()
)
WITH CHECK (
  public.get_user_role() IN ('admin', 'super_admin')
  OR deal_owner_id = auth.uid()
);

CREATE POLICY "deals_delete_policy" ON deals
FOR DELETE TO authenticated
USING (public.get_user_role() IN ('admin', 'super_admin'));

-- DEAL_ACTIVITIES TABLE (inherits from deals visibility)
DROP POLICY IF EXISTS "Allow authenticated full access" ON deal_activities;

CREATE POLICY "deal_activities_select_policy" ON deal_activities
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_activities.deal_id));

CREATE POLICY "deal_activities_insert_policy" ON deal_activities
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_activities.deal_id));

CREATE POLICY "deal_activities_update_policy" ON deal_activities
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_activities.deal_id));

CREATE POLICY "deal_activities_delete_policy" ON deal_activities
FOR DELETE TO authenticated
USING (public.get_user_role() IN ('admin', 'super_admin'));

-- AUTOMATION_ENROLLMENTS TABLE
DROP POLICY IF EXISTS "Allow authenticated full access" ON automation_enrollments;

CREATE POLICY "automation_enrollments_select_policy" ON automation_enrollments
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM deals WHERE deals.id = automation_enrollments.deal_id));

CREATE POLICY "automation_enrollments_insert_policy" ON automation_enrollments
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM deals WHERE deals.id = automation_enrollments.deal_id));

CREATE POLICY "automation_enrollments_update_policy" ON automation_enrollments
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM deals WHERE deals.id = automation_enrollments.deal_id));

CREATE POLICY "automation_enrollments_delete_policy" ON automation_enrollments
FOR DELETE TO authenticated
USING (public.get_user_role() IN ('admin', 'super_admin'));

-- AUTOMATION_LOGS TABLE
DROP POLICY IF EXISTS "Allow authenticated full access" ON automation_logs;

CREATE POLICY "automation_logs_select_policy" ON automation_logs
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM deals WHERE deals.id = automation_logs.deal_id));

CREATE POLICY "automation_logs_insert_policy" ON automation_logs
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM deals WHERE deals.id = automation_logs.deal_id));

CREATE POLICY "automation_logs_update_policy" ON automation_logs
FOR UPDATE TO authenticated
USING (public.get_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "automation_logs_delete_policy" ON automation_logs
FOR DELETE TO authenticated
USING (public.get_user_role() IN ('admin', 'super_admin'));
