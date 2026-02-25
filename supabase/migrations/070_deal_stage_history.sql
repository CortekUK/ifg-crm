-- Deal stage history table — tracks every stage transition for analytics
CREATE TABLE deal_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  from_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  to_stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deal_stage_history_deal ON deal_stage_history(deal_id);
CREATE INDEX idx_deal_stage_history_to_stage ON deal_stage_history(to_stage_id);
CREATE INDEX idx_deal_stage_history_changed_at ON deal_stage_history(changed_at DESC);

-- RLS
ALTER TABLE deal_stage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read deal stage history" ON deal_stage_history
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can insert deal stage history" ON deal_stage_history
  FOR INSERT WITH CHECK (true);

-- Trigger function to auto-log stage changes
CREATE OR REPLACE FUNCTION log_deal_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if current_stage_id actually changed
  IF OLD.current_stage_id IS DISTINCT FROM NEW.current_stage_id THEN
    INSERT INTO deal_stage_history (deal_id, from_stage_id, to_stage_id, changed_by)
    VALUES (
      NEW.id,
      OLD.current_stage_id,
      NEW.current_stage_id,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_deal_stage_change
  AFTER UPDATE OF current_stage_id ON deals
  FOR EACH ROW
  EXECUTE FUNCTION log_deal_stage_change();
