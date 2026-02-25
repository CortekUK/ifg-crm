-- SMS sends tracking table (parallel to email_sends)
CREATE TABLE sms_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id UUID NOT NULL DEFAULT gen_random_uuid(),
  recipient_phone TEXT NOT NULL,
  recipient_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  automation_log_id UUID REFERENCES automation_logs(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','delivered','failed','bounced')),
  clicksend_message_id TEXT,
  error_message TEXT,
  segments INTEGER DEFAULT 1,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sms_sends_campaign ON sms_sends(campaign_id);
CREATE INDEX idx_sms_sends_contact ON sms_sends(recipient_contact_id);
CREATE INDEX idx_sms_sends_tracking ON sms_sends(tracking_id);
CREATE INDEX idx_sms_sends_clicksend_id ON sms_sends(clicksend_message_id);

-- RLS
ALTER TABLE sms_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read sms_sends" ON sms_sends FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can insert sms_sends" ON sms_sends FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update sms_sends" ON sms_sends FOR UPDATE USING (true);
