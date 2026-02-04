-- User invites table for tracking pending invitations
CREATE TABLE IF NOT EXISTS user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'recruiter' CHECK (role IN ('super_admin', 'admin', 'recruiter')),
  sport TEXT NOT NULL DEFAULT 'football' CHECK (sport IN ('football', 'basketball')),
  calendly_url TEXT,
  invited_by UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

-- RLS policies for user_invites
ALTER TABLE user_invites ENABLE ROW LEVEL SECURITY;

-- Admins can manage invites
CREATE POLICY "user_invites_select_policy" ON user_invites
FOR SELECT TO authenticated
USING (public.get_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "user_invites_insert_policy" ON user_invites
FOR INSERT TO authenticated
WITH CHECK (public.get_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "user_invites_update_policy" ON user_invites
FOR UPDATE TO authenticated
USING (public.get_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "user_invites_delete_policy" ON user_invites
FOR DELETE TO authenticated
USING (public.get_user_role() IN ('admin', 'super_admin'));

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_invites_email ON user_invites(email);
CREATE INDEX IF NOT EXISTS idx_user_invites_status ON user_invites(status);
