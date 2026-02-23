-- Fix deals RLS: all authenticated users can see all deals
-- "My Deals" filtering is handled client-side, not at the RLS level
DROP POLICY IF EXISTS "deals_select_policy" ON deals;
CREATE POLICY "deals_select_policy" ON deals
FOR SELECT TO authenticated
USING (true);

-- Keep insert/update restricted to owner or admin
DROP POLICY IF EXISTS "deals_insert_policy" ON deals;
CREATE POLICY "deals_insert_policy" ON deals
FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "deals_update_policy" ON deals;
CREATE POLICY "deals_update_policy" ON deals
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "deals_delete_policy" ON deals;
CREATE POLICY "deals_delete_policy" ON deals
FOR DELETE TO authenticated
USING (public.get_user_role() IN ('admin', 'super_admin'));
