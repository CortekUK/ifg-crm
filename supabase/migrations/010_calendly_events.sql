-- Migration: Calendly Integration
-- Creates table for storing Calendly events and adds user settings for Calendly connection

-- Calendly Events Table
CREATE TABLE IF NOT EXISTS calendly_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- The recruiter/host
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL, -- Associated deal if any
  
  -- Event details
  event_type TEXT NOT NULL, -- e.g., "30-minute-intro-call", "zoom-call"
  event_name TEXT NOT NULL, -- e.g., "30 Minute Intro Call"
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER,
  
  -- Location/meeting details
  location TEXT, -- Physical location or "Zoom", "Google Meet", etc.
  join_url TEXT, -- Video call URL
  
  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled', 'no_show'
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  -- Calendly external IDs
  calendly_event_id TEXT UNIQUE, -- Calendly's unique event ID
  calendly_invitee_id TEXT, -- Calendly's invitee ID
  calendly_event_uri TEXT, -- Full Calendly URI
  
  -- Invitee details (stored for reference even if contact match fails)
  invitee_email TEXT,
  invitee_name TEXT,
  invitee_timezone TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for calendly_events
CREATE INDEX IF NOT EXISTS idx_calendly_events_contact_id ON calendly_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_calendly_events_user_id ON calendly_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendly_events_deal_id ON calendly_events(deal_id);
CREATE INDEX IF NOT EXISTS idx_calendly_events_start_time ON calendly_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendly_events_status ON calendly_events(status);
CREATE INDEX IF NOT EXISTS idx_calendly_events_calendly_event_id ON calendly_events(calendly_event_id);

-- RLS Policies for calendly_events
ALTER TABLE calendly_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view calendly events" ON calendly_events
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage calendly events" ON calendly_events
  FOR ALL USING (true);

-- Add Calendly settings to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS calendly_access_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS calendly_webhook_secret TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS calendly_user_uri TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS calendly_connected_at TIMESTAMPTZ;

-- Organisation-level Calendly settings (store in a settings table or use existing)
-- For now, we'll store webhook signing key as a Supabase secret

-- Comments for documentation
COMMENT ON TABLE calendly_events IS 'Stores Calendly meeting events linked to contacts and deals';
COMMENT ON COLUMN calendly_events.status IS 'Event status: scheduled, completed, cancelled, no_show';
COMMENT ON COLUMN calendly_events.calendly_event_id IS 'Unique identifier from Calendly API';
COMMENT ON COLUMN profiles.calendly_access_token IS 'Encrypted Calendly Personal Access Token for API calls';
COMMENT ON COLUMN profiles.calendly_user_uri IS 'Calendly user URI for matching webhook events';

-- Function to check for upcoming Calendly events for a contact
CREATE OR REPLACE FUNCTION get_upcoming_calendly_events(
  p_contact_id UUID,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  event_name TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  location TEXT,
  join_url TEXT,
  status TEXT,
  user_full_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ce.id,
    ce.event_name,
    ce.start_time,
    ce.end_time,
    ce.location,
    ce.join_url,
    ce.status,
    p.full_name as user_full_name
  FROM calendly_events ce
  LEFT JOIN profiles p ON ce.user_id = p.id
  WHERE ce.contact_id = p_contact_id
    AND ce.status = 'scheduled'
    AND ce.start_time > NOW()
  ORDER BY ce.start_time ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-complete past events
CREATE OR REPLACE FUNCTION update_completed_calendly_events()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE calendly_events
  SET 
    status = 'completed',
    updated_at = NOW()
  WHERE status = 'scheduled'
    AND end_time < NOW();
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;
