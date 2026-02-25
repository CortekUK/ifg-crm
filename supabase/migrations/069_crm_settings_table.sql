-- CRM Settings table (key-value store for app-wide settings)
CREATE TABLE crm_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Seed default settings
INSERT INTO crm_settings (key, value) VALUES
  ('general', '{"companyName": "International Football Group", "defaultCurrency": "GBP", "timezone": "Europe/London", "dateFormat": "DD/MM/YYYY"}'::jsonb),
  ('email', '{"defaultFromName": "", "defaultFromEmail": "", "replyToEmail": "", "emailSignature": "", "unsubscribeFooter": ""}'::jsonb),
  ('sms', '{"defaultSMSNumber": "", "smsSignature": "", "characterLimitWarning": 140}'::jsonb),
  ('notifications', '{"emailNotifications": {"newLead": true, "smsReply": true, "emailReply": true, "paymentReceived": true, "dealWon": true}, "browserNotifications": false}'::jsonb);

-- RLS
ALTER TABLE crm_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read settings" ON crm_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can update settings" ON crm_settings FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can insert settings" ON crm_settings FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
