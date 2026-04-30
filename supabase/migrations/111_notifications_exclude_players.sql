-- Migration: notify_all_users skips player profiles.
--
-- The original 076 implementation fanned every CRM event (deal stage
-- moves, email replies, new leads, etc.) out to every active profile —
-- including players. The portal Notifications dropdown then showed deal
-- stage changes and email replies belonging to recruiters, which players
-- have no business seeing.
--
-- New behaviour: notify_all_users targets staff roles only (admin,
-- super_admin, recruiter). Player-specific notifications continue to be
-- written via notify_user(p_user_id, ...) by the code paths that emit
-- them (e.g. send-with-link writes a 'payment' notification to the
-- player's profile).
--
-- Backfill at the bottom removes the player-irrelevant rows already in
-- the table so the portal dropdown clears up on the next load.

CREATE OR REPLACE FUNCTION notify_all_users(
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_href TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS void AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, href, metadata)
  SELECT id, p_type, p_title, p_message, p_href, p_metadata
  FROM profiles
  WHERE is_active = true
    AND role IN ('admin', 'super_admin', 'recruiter');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up existing CRM-internal notifications that landed in player
-- profiles. We keep 'payment' and 'general' types — those can be
-- legitimately addressed to players (invoice sent, welcome message etc.).
DELETE FROM notifications
WHERE user_id IN (SELECT id FROM profiles WHERE role = 'player')
  AND type IN ('deal_won', 'deal_lost', 'deal_stage', 'new_lead', 'email_reply', 'sms_reply', 'form_submission');
