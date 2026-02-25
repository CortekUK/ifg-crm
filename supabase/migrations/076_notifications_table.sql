-- Notifications table for CRM users (not portal contacts)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('email_reply', 'sms_reply', 'payment', 'new_lead', 'deal_won', 'deal_lost', 'deal_stage', 'form_submission', 'general')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  href TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE NOT is_read;
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Enable realtime for live notification updates
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-------------------------------------------------------------------
-- Helper: create a notification for all active admin/agent users
-------------------------------------------------------------------
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
  WHERE is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-------------------------------------------------------------------
-- Helper: create a notification for a specific user
-------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_user(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_href TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS void AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, href, metadata)
  VALUES (p_user_id, p_type, p_title, p_message, p_href, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-------------------------------------------------------------------
-- Trigger: New contact created → new_lead notification
-------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_contact_notification()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM notify_all_users(
    'new_lead',
    'New lead',
    COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '') || COALESCE(' — ' || NEW.email, ''),
    '/contacts',
    jsonb_build_object('contact_id', NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_contact_notification
  AFTER INSERT ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_contact_notification();

-------------------------------------------------------------------
-- Trigger: Deal stage changed → deal_stage / deal_won / deal_lost
-------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_deal_stage_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_deal RECORD;
  v_stage RECORD;
  v_contact_name TEXT;
  v_type TEXT;
  v_title TEXT;
BEGIN
  -- Get deal + contact info
  SELECT d.title AS deal_title, c.first_name, c.last_name
  INTO v_deal
  FROM deals d
  LEFT JOIN contacts c ON c.id = d.contact_id
  WHERE d.id = NEW.deal_id;

  -- Get the new stage info
  SELECT name, stage_type INTO v_stage
  FROM pipeline_stages
  WHERE id = NEW.to_stage_id;

  v_contact_name := COALESCE(v_deal.first_name, '') || ' ' || COALESCE(v_deal.last_name, '');

  -- Determine notification type
  IF v_stage.stage_type = 'completed' THEN
    v_type := 'deal_won';
    v_title := 'Deal won!';
  ELSIF v_stage.stage_type = 'lost' THEN
    v_type := 'deal_lost';
    v_title := 'Deal lost';
  ELSE
    v_type := 'deal_stage';
    v_title := 'Deal moved to ' || v_stage.name;
  END IF;

  PERFORM notify_all_users(
    v_type,
    v_title,
    TRIM(v_contact_name) || CASE WHEN v_deal.deal_title IS NOT NULL THEN ' — ' || v_deal.deal_title ELSE '' END,
    '/pipelines',
    jsonb_build_object('deal_id', NEW.deal_id, 'stage_id', NEW.to_stage_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_deal_stage_change_notification
  AFTER INSERT ON deal_stage_history
  FOR EACH ROW
  EXECUTE FUNCTION handle_deal_stage_notification();

-------------------------------------------------------------------
-- Trigger: Email reply received → email_reply notification
-------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_email_reply_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_contact RECORD;
BEGIN
  SELECT first_name, last_name INTO v_contact
  FROM contacts WHERE id = NEW.contact_id;

  PERFORM notify_all_users(
    'email_reply',
    'New email reply',
    COALESCE(v_contact.first_name, '') || ' ' || COALESCE(v_contact.last_name, NEW.from_email) || ' replied to your email',
    '/contacts',
    jsonb_build_object('contact_id', NEW.contact_id, 'reply_id', NEW.id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_email_reply_notification
  AFTER INSERT ON email_replies
  FOR EACH ROW
  EXECUTE FUNCTION handle_email_reply_notification();

-------------------------------------------------------------------
-- Trigger: Inbound SMS → sms_reply notification
-------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_sms_reply_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_contact RECORD;
BEGIN
  -- Only notify on inbound messages
  IF NEW.direction <> 'inbound' THEN
    RETURN NEW;
  END IF;

  IF NEW.contact_id IS NOT NULL THEN
    SELECT first_name, last_name INTO v_contact
    FROM contacts WHERE id = NEW.contact_id;

    PERFORM notify_all_users(
      'sms_reply',
      'SMS reply',
      COALESCE(v_contact.first_name, '') || ' ' || COALESCE(v_contact.last_name, '') || ' replied to your SMS',
      '/contacts',
      jsonb_build_object('contact_id', NEW.contact_id, 'sms_id', NEW.id)
    );
  ELSE
    PERFORM notify_all_users(
      'sms_reply',
      'SMS reply',
      'New SMS from ' || NEW.phone_number,
      '/contacts',
      jsonb_build_object('sms_id', NEW.id, 'phone', NEW.phone_number)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_sms_reply_notification
  AFTER INSERT ON sms_messages
  FOR EACH ROW
  EXECUTE FUNCTION handle_sms_reply_notification();

-------------------------------------------------------------------
-- Auto-clean old notifications (> 30 days)
-------------------------------------------------------------------
CREATE OR REPLACE FUNCTION clean_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
