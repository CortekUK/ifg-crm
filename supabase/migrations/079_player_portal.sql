-- ============================================
-- Player Portal Schema Changes
-- ============================================

-- 1. Add 'player' role to profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'recruiter', 'player'));

-- 2. Add contact_id to profiles (links player auth user to their contact record)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_contact_id ON profiles(contact_id) WHERE contact_id IS NOT NULL;

-- 3. Add Stripe fields
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

-- 4. Helper function to get player's contact_id from auth
CREATE OR REPLACE FUNCTION get_player_contact_id()
RETURNS UUID AS $$
  SELECT contact_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 5. Player invites table
CREATE TABLE IF NOT EXISTS player_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  invited_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

ALTER TABLE player_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage player invites"
  ON player_invites FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'super_admin'));

-- 6. Update handle_new_user to support player role with contact_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, sport, title, phone, calendly_url, zoom_url, contact_id)
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
    (NEW.raw_user_meta_data->>'contact_id')::UUID
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RLS policies for player access
-- Players can view their own contact record
CREATE POLICY "Players can view own contact"
  ON contacts FOR SELECT TO authenticated
  USING (
    public.get_user_role() != 'player'
    OR id = public.get_player_contact_id()
  );

-- Players can view their own invoices
CREATE POLICY "Players can view own invoices"
  ON invoices FOR SELECT TO authenticated
  USING (
    public.get_user_role() != 'player'
    OR contact_id = public.get_player_contact_id()
  );

-- Players can view their own payments
CREATE POLICY "Players can view own payments"
  ON payments FOR SELECT TO authenticated
  USING (
    public.get_user_role() != 'player'
    OR contact_id = public.get_player_contact_id()
  );

-- Players can view their own deals
CREATE POLICY "Players can view own deals"
  ON deals FOR SELECT TO authenticated
  USING (
    public.get_user_role() != 'player'
    OR contact_id = public.get_player_contact_id()
  );

-- Players can read pipeline stages and pipelines (needed for stage display)
CREATE POLICY "Players can view pipeline stages"
  ON pipeline_stages FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Players can view pipelines"
  ON pipelines FOR SELECT TO authenticated
  USING (true);

-- Players can view deal stage history for their own deals
CREATE POLICY "Players can view own deal stage history"
  ON deal_stage_history FOR SELECT TO authenticated
  USING (
    public.get_user_role() != 'player'
    OR deal_id IN (SELECT id FROM deals WHERE contact_id = public.get_player_contact_id())
  );

-- Players can view campaign recipients for themselves
CREATE POLICY "Players can view own campaign recipients"
  ON campaign_recipients FOR SELECT TO authenticated
  USING (
    public.get_user_role() != 'player'
    OR contact_id = public.get_player_contact_id()
  );
