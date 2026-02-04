-- Migration: Manual Round-Robin Support
-- Adds support for round-robin assignment when creating deals manually

-- Table to track manual round-robin state (separate from automation round-robin)
CREATE TABLE IF NOT EXISTS manual_round_robin_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_key TEXT NOT NULL UNIQUE,
  last_assigned_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  last_assigned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for pipeline_key lookups
CREATE INDEX IF NOT EXISTS idx_manual_round_robin_state_pipeline_key
  ON manual_round_robin_state(pipeline_key);

-- RLS Policies
ALTER TABLE manual_round_robin_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view manual round robin state" ON manual_round_robin_state
  FOR SELECT USING (true);

CREATE POLICY "Users can manage manual round robin state" ON manual_round_robin_state
  FOR ALL USING (true);

-- Function to get next round-robin user for manual deal creation
CREATE OR REPLACE FUNCTION get_next_round_robin_user_manual(
  p_pipeline_key TEXT,
  p_user_ids UUID[]
)
RETURNS UUID AS $$
DECLARE
  v_last_user_id UUID;
  v_last_index INTEGER;
  v_next_index INTEGER;
  v_next_user_id UUID;
BEGIN
  -- Get the last assigned user for this pipeline
  SELECT last_assigned_user_id INTO v_last_user_id
  FROM manual_round_robin_state
  WHERE pipeline_key = p_pipeline_key;

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

  -- Update or insert manual round robin state
  INSERT INTO manual_round_robin_state (pipeline_key, last_assigned_user_id, last_assigned_at)
  VALUES (p_pipeline_key, v_next_user_id, NOW())
  ON CONFLICT (pipeline_key)
  DO UPDATE SET
    last_assigned_user_id = v_next_user_id,
    last_assigned_at = NOW(),
    updated_at = NOW();

  RETURN v_next_user_id;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE manual_round_robin_state IS 'Tracks the last assigned user for manual deal creation round-robin per pipeline';
COMMENT ON FUNCTION get_next_round_robin_user_manual IS 'Returns the next user in the round-robin rotation for manual deal creation';
