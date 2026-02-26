-- Fix audit log trigger: contacts table uses first_name/last_name, not full_name
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
  IF OLD.first_name IS DISTINCT FROM NEW.first_name THEN
    old_fields := old_fields || jsonb_build_object('first_name', OLD.first_name);
    changed_fields := changed_fields || jsonb_build_object('first_name', NEW.first_name);
  END IF;
  IF OLD.last_name IS DISTINCT FROM NEW.last_name THEN
    old_fields := old_fields || jsonb_build_object('last_name', OLD.last_name);
    changed_fields := changed_fields || jsonb_build_object('last_name', NEW.last_name);
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
