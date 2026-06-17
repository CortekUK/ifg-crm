-- Migration 137: stop any authenticated user from updating any profile.
--
-- The original policy was `FOR UPDATE USING (true)`, which let any logged-in
-- user edit any profile row — including escalating their own `role`. Replace it
-- with: you may update your OWN row, or any row if you're an admin/super_admin
-- (admins manage users from the client). A trigger additionally blocks
-- non-admins from changing the `role` column on their own row.
--
-- SELECT stays permissive on purpose — the app needs to read teammates' names,
-- owners and booking links. Secrets were moved out in migration 136.

-- Caller's role. SECURITY DEFINER so it does NOT recurse through the profiles
-- RLS policy we (re)define below.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

DROP POLICY IF EXISTS "Allow authenticated update" ON profiles;
CREATE POLICY "profiles_update_self_or_admin" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.current_user_role() IN ('admin', 'super_admin'))
  WITH CHECK (id = auth.uid() OR public.current_user_role() IN ('admin', 'super_admin'));

-- Block self role-escalation. Admins (via the client) and the service role
-- (auth.uid() IS NULL, e.g. the invite route) are allowed to change roles.
CREATE OR REPLACE FUNCTION public.prevent_role_self_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() IS NOT NULL
     AND public.current_user_role() NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Only admins can change a user role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_self_change ON profiles;
CREATE TRIGGER trg_prevent_role_self_change
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_change();
