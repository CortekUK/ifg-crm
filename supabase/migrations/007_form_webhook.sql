-- Migration: Form Webhook Support
-- Creates tables for round-robin assignment tracking and form submission logging

-- Round Robin State Table
-- Tracks the last assigned user for each automation to enable fair distribution
CREATE TABLE IF NOT EXISTS round_robin_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  last_assigned_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  last_assigned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(automation_id)
);

-- Form Submissions Table
-- Logs all incoming form submissions for debugging and audit purposes
CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id TEXT NOT NULL,
  form_source TEXT, -- 'gravity_forms', 'wpforms', 'generic', etc.
  payload JSONB NOT NULL DEFAULT '{}',
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  automation_id UUID REFERENCES automations(id) ON DELETE SET NULL,
  assigned_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processed', 'failed', 'skipped'
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Indexes for round_robin_state
CREATE INDEX IF NOT EXISTS idx_round_robin_state_automation_id ON round_robin_state(automation_id);

-- Indexes for form_submissions
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_id ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_contact_id ON form_submissions(contact_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_deal_id ON form_submissions(deal_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_automation_id ON form_submissions(automation_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON form_submissions(status);
CREATE INDEX IF NOT EXISTS idx_form_submissions_created_at ON form_submissions(created_at DESC);

-- RLS Policies for round_robin_state
ALTER TABLE round_robin_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view round robin state" ON round_robin_state
  FOR SELECT USING (true);

CREATE POLICY "Users can update round robin state" ON round_robin_state
  FOR ALL USING (true);

-- RLS Policies for form_submissions
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view form submissions" ON form_submissions
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage form submissions" ON form_submissions
  FOR ALL USING (true);

-- Function to get next round-robin user
CREATE OR REPLACE FUNCTION get_next_round_robin_user(
  p_automation_id UUID,
  p_user_ids UUID[]
)
RETURNS UUID AS $$
DECLARE
  v_last_user_id UUID;
  v_last_index INTEGER;
  v_next_index INTEGER;
  v_next_user_id UUID;
BEGIN
  -- Get the last assigned user for this automation
  SELECT last_assigned_user_id INTO v_last_user_id
  FROM round_robin_state
  WHERE automation_id = p_automation_id;

  -- If no state exists or no users provided, start with first user
  IF v_last_user_id IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
    v_next_user_id := p_user_ids[1];
  ELSE
    -- Find the index of the last assigned user
    v_last_index := array_position(p_user_ids, v_last_user_id);
    
    -- If user not found in list, start from beginning
    IF v_last_index IS NULL THEN
      v_next_index := 1;
    ELSE
      -- Move to next user, wrap around if at end
      v_next_index := v_last_index + 1;
      IF v_next_index > array_length(p_user_ids, 1) THEN
        v_next_index := 1;
      END IF;
    END IF;
    
    v_next_user_id := p_user_ids[v_next_index];
  END IF;

  -- Update or insert round robin state
  INSERT INTO round_robin_state (automation_id, last_assigned_user_id, last_assigned_at)
  VALUES (p_automation_id, v_next_user_id, NOW())
  ON CONFLICT (automation_id) 
  DO UPDATE SET 
    last_assigned_user_id = v_next_user_id,
    last_assigned_at = NOW(),
    updated_at = NOW();

  RETURN v_next_user_id;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON TABLE round_robin_state IS 'Tracks the last assigned user for each automation to enable fair round-robin distribution of deals';
COMMENT ON TABLE form_submissions IS 'Logs all incoming form submissions for debugging, audit, and analytics purposes';
COMMENT ON FUNCTION get_next_round_robin_user IS 'Returns the next user in the round-robin rotation for a given automation';
