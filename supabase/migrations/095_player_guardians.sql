-- Migration: multi-contact portal access (player + guardians)
-- A player is the primary portal user. Guardians are separate auth users
-- linked to a player via this join table; their portal sees the player's data.
-- Player must already have an active portal (email_confirmed_at set on auth.users)
-- before guardians can be invited — enforced in app code, not DB.

CREATE TABLE IF NOT EXISTS player_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  guardian_contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_contact_id, guardian_contact_id),
  CHECK (player_contact_id <> guardian_contact_id)
);

CREATE INDEX IF NOT EXISTS idx_player_guardians_player
  ON player_guardians(player_contact_id);
CREATE INDEX IF NOT EXISTS idx_player_guardians_guardian
  ON player_guardians(guardian_contact_id);

ALTER TABLE player_guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage player_guardians"
  ON player_guardians FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'super_admin'));

-- Players & guardians can read their own links (so the portal can render
-- "you are a guardian for X" without admin role).
CREATE POLICY "Portal users read own guardian links"
  ON player_guardians FOR SELECT TO authenticated
  USING (
    player_contact_id = public.get_player_contact_id()
    OR guardian_contact_id = public.get_player_contact_id()
  );

-- Returns every player contact_id this auth user can see in the portal:
--   - their own contact (if they are a player), AND
--   - every player they are a guardian for.
CREATE OR REPLACE FUNCTION get_player_contact_ids()
RETURNS UUID[] AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT contact_id FROM public.profiles
       WHERE id = auth.uid() AND contact_id IS NOT NULL
      UNION
      SELECT pg.player_contact_id FROM public.player_guardians pg
        JOIN public.profiles p ON p.contact_id = pg.guardian_contact_id
       WHERE p.id = auth.uid()
    ),
    ARRAY[]::UUID[]
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Replace the single-id RLS policies from migration 079 with array-based ones.
DROP POLICY IF EXISTS "Players can view own contact" ON contacts;
CREATE POLICY "Players can view own contact"
  ON contacts FOR SELECT TO authenticated
  USING (
    public.get_user_role() != 'player'
    OR id = ANY(public.get_player_contact_ids())
  );

DROP POLICY IF EXISTS "Players can view own invoices" ON invoices;
CREATE POLICY "Players can view own invoices"
  ON invoices FOR SELECT TO authenticated
  USING (
    public.get_user_role() != 'player'
    OR contact_id = ANY(public.get_player_contact_ids())
  );

DROP POLICY IF EXISTS "Players can view own payments" ON payments;
CREATE POLICY "Players can view own payments"
  ON payments FOR SELECT TO authenticated
  USING (
    public.get_user_role() != 'player'
    OR contact_id = ANY(public.get_player_contact_ids())
  );

DROP POLICY IF EXISTS "Players can view own deals" ON deals;
CREATE POLICY "Players can view own deals"
  ON deals FOR SELECT TO authenticated
  USING (
    public.get_user_role() != 'player'
    OR contact_id = ANY(public.get_player_contact_ids())
  );

DROP POLICY IF EXISTS "Players can view own deal stage history" ON deal_stage_history;
CREATE POLICY "Players can view own deal stage history"
  ON deal_stage_history FOR SELECT TO authenticated
  USING (
    public.get_user_role() != 'player'
    OR deal_id IN (
      SELECT id FROM deals WHERE contact_id = ANY(public.get_player_contact_ids())
    )
  );

DROP POLICY IF EXISTS "Players can view own campaign recipients" ON campaign_recipients;
CREATE POLICY "Players can view own campaign recipients"
  ON campaign_recipients FOR SELECT TO authenticated
  USING (
    public.get_user_role() != 'player'
    OR contact_id = ANY(public.get_player_contact_ids())
  );
