-- Migration: simplify guardian portal access.
-- Replaces 095's player_guardians join table + array RLS helper with a single
-- column on profiles. A guardian's auth user has profiles.guardian_for_contact_id
-- pointing to the player's contact; their portal sees that player's data.
-- Uses the existing parent_name / parent_email / parent_phone fields on the
-- contact — no new contact rows, no picker, one parent per player.

-- 1. Drop the previous join-table approach.
DROP POLICY IF EXISTS "Admins manage player_guardians" ON player_guardians;
DROP POLICY IF EXISTS "Portal users read own guardian links" ON player_guardians;
DROP TABLE IF EXISTS player_guardians;

-- 2. Drop array RLS policies installed by 095 and the array helper.
DROP POLICY IF EXISTS "Players can view own contact" ON contacts;
DROP POLICY IF EXISTS "Players can view own invoices" ON invoices;
DROP POLICY IF EXISTS "Players can view own payments" ON payments;
DROP POLICY IF EXISTS "Players can view own deals" ON deals;
DROP POLICY IF EXISTS "Players can view own deal stage history" ON deal_stage_history;
DROP POLICY IF EXISTS "Players can view own campaign recipients" ON campaign_recipients;
DROP FUNCTION IF EXISTS public.get_player_contact_ids();

-- 3. Add the link column on profiles. NULL for staff & player accounts;
--    set for guardian auth users to point at the player they have access to.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS guardian_for_contact_id UUID
  REFERENCES contacts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_profiles_guardian_for_contact_id
  ON profiles(guardian_for_contact_id) WHERE guardian_for_contact_id IS NOT NULL;

-- 4. Restore scalar helper, but resolving via COALESCE — a player sees their
--    own contact, a guardian sees the player they're linked to.
CREATE OR REPLACE FUNCTION public.get_player_contact_id()
RETURNS UUID AS $$
  SELECT COALESCE(contact_id, guardian_for_contact_id)
  FROM public.profiles
  WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 5. Restore the scalar RLS policies from migration 079 unchanged.
CREATE POLICY "Players can view own contact"
  ON contacts FOR SELECT TO authenticated
  USING (
    public.get_user_role() != 'player'
    OR id = public.get_player_contact_id()
  );

CREATE POLICY "Players can view own invoices"
  ON invoices FOR SELECT TO authenticated
  USING (
    public.get_user_role() != 'player'
    OR contact_id = public.get_player_contact_id()
  );

CREATE POLICY "Players can view own payments"
  ON payments FOR SELECT TO authenticated
  USING (
    public.get_user_role() != 'player'
    OR contact_id = public.get_player_contact_id()
  );

CREATE POLICY "Players can view own deals"
  ON deals FOR SELECT TO authenticated
  USING (
    public.get_user_role() != 'player'
    OR contact_id = public.get_player_contact_id()
  );

CREATE POLICY "Players can view own deal stage history"
  ON deal_stage_history FOR SELECT TO authenticated
  USING (
    public.get_user_role() != 'player'
    OR deal_id IN (SELECT id FROM deals WHERE contact_id = public.get_player_contact_id())
  );

CREATE POLICY "Players can view own campaign recipients"
  ON campaign_recipients FOR SELECT TO authenticated
  USING (
    public.get_user_role() != 'player'
    OR contact_id = public.get_player_contact_id()
  );

-- 6. Update handle_new_user to also pull guardian_for_contact_id from invite metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, role, sport, title, phone, calendly_url, zoom_url,
    contact_id, guardian_for_contact_id
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'recruiter'),
    COALESCE(NEW.raw_user_meta_data->>'sport', 'football'),
    NEW.raw_user_meta_data->>'title',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'calendly_url',
    NEW.raw_user_meta_data->>'zoom_url',
    (NEW.raw_user_meta_data->>'contact_id')::UUID,
    (NEW.raw_user_meta_data->>'guardian_for_contact_id')::UUID
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
