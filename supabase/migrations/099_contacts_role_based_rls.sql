-- Migration: scope contact visibility to recruiter ownership at the DB level.
-- Currently all authenticated users can read every contact via the legacy
-- "Allow authenticated full access" blanket policy (migration 001), with only
-- a player-specific SELECT override layered on top. We replace it with
-- per-action policies that:
--   - admin / super_admin: full access (unchanged behavior)
--   - recruiter: SELECT/UPDATE only contacts they own (contacts.owner_id) OR
--     contacts they handle a deal for (deals.deal_owner_id). INSERT allowed.
--     DELETE blocked (admin only).
--   - player: existing get_player_contact_id() rule kept.
-- Service-role callers (webhooks, edge functions) bypass RLS so the form
-- ingestion path is unaffected.

-- 1. Drop the blanket policy installed by the initial schema.
DROP POLICY IF EXISTS "Allow authenticated full access" ON contacts;

-- 2. Drop the player SELECT policy so we can fold it into the new policy and
--    keep the count of overlapping policies low.
DROP POLICY IF EXISTS "Players can view own contact" ON contacts;

-- 3. SELECT — admin/super_admin see all; recruiter sees their own + deal contacts;
--    player sees their own contact (or the player they're a guardian for).
CREATE POLICY "contacts_select_policy"
  ON contacts FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('admin', 'super_admin')
    OR (
      public.get_user_role() = 'recruiter'
      AND (
        owner_id = auth.uid()
        OR id IN (SELECT contact_id FROM deals WHERE deal_owner_id = auth.uid())
      )
    )
    OR (
      public.get_user_role() = 'player'
      AND id = public.get_player_contact_id()
    )
  );

-- 4. INSERT — any authenticated non-player role can create contacts.
CREATE POLICY "contacts_insert_policy"
  ON contacts FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('admin', 'super_admin', 'recruiter')
  );

-- 5. UPDATE — admin/super_admin can edit anything; recruiter can edit contacts
--    they own or have a deal for.
CREATE POLICY "contacts_update_policy"
  ON contacts FOR UPDATE TO authenticated
  USING (
    public.get_user_role() IN ('admin', 'super_admin')
    OR (
      public.get_user_role() = 'recruiter'
      AND (
        owner_id = auth.uid()
        OR id IN (SELECT contact_id FROM deals WHERE deal_owner_id = auth.uid())
      )
    )
  )
  WITH CHECK (
    public.get_user_role() IN ('admin', 'super_admin')
    OR (
      public.get_user_role() = 'recruiter'
      AND (
        owner_id = auth.uid()
        OR id IN (SELECT contact_id FROM deals WHERE deal_owner_id = auth.uid())
      )
    )
  );

-- 6. DELETE — admin/super_admin only.
CREATE POLICY "contacts_delete_policy"
  ON contacts FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('admin', 'super_admin'));
