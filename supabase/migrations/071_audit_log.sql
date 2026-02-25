-- Audit log table for tracking key actions
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read audit log" ON audit_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert audit log" ON audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- Trigger to auto-log contact updates
CREATE OR REPLACE FUNCTION log_contact_update()
RETURNS TRIGGER AS $$
DECLARE
  changed_fields JSONB := '{}'::jsonb;
  old_fields JSONB := '{}'::jsonb;
BEGIN
  -- Track meaningful field changes
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    old_fields := old_fields || jsonb_build_object('email', OLD.email);
    changed_fields := changed_fields || jsonb_build_object('email', NEW.email);
  END IF;
  IF OLD.full_name IS DISTINCT FROM NEW.full_name THEN
    old_fields := old_fields || jsonb_build_object('full_name', OLD.full_name);
    changed_fields := changed_fields || jsonb_build_object('full_name', NEW.full_name);
  END IF;
  IF OLD.phone IS DISTINCT FROM NEW.phone THEN
    old_fields := old_fields || jsonb_build_object('phone', OLD.phone);
    changed_fields := changed_fields || jsonb_build_object('phone', NEW.phone);
  END IF;
  IF OLD.subscription_status IS DISTINCT FROM NEW.subscription_status THEN
    old_fields := old_fields || jsonb_build_object('subscription_status', OLD.subscription_status);
    changed_fields := changed_fields || jsonb_build_object('subscription_status', NEW.subscription_status);
  END IF;

  -- Only log if something actually changed
  IF changed_fields != '{}'::jsonb THEN
    INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value)
    VALUES (auth.uid(), 'updated', 'contact', NEW.id, old_fields, changed_fields);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_contact_update
  AFTER UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION log_contact_update();
