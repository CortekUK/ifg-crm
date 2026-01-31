-- ============================================
-- Email Sends Tracking Table
-- ============================================
-- Tracks all emails sent via Resend for campaigns and automations

CREATE TABLE IF NOT EXISTS email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tracking identifier (used for webhooks and open/click tracking)
  tracking_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  
  -- Recipient info
  recipient_email TEXT NOT NULL,
  recipient_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  
  -- Source of email (campaign or automation)
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  automation_log_id UUID REFERENCES automation_logs(id) ON DELETE SET NULL,
  
  -- Email content
  subject TEXT NOT NULL,
  from_name TEXT,
  from_email TEXT,
  
  -- Timestamps
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  complained_at TIMESTAMPTZ,
  
  -- Engagement metrics
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed')),
  
  -- Resend integration
  resend_message_id TEXT,
  error_message TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_email_sends_tracking_id ON email_sends(tracking_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_recipient_email ON email_sends(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_sends_recipient_contact_id ON email_sends(recipient_contact_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_campaign_id ON email_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_automation_log_id ON email_sends(automation_log_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_resend_message_id ON email_sends(resend_message_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_status ON email_sends(status);
CREATE INDEX IF NOT EXISTS idx_email_sends_sent_at ON email_sends(sent_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE email_sends ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read email sends
CREATE POLICY "Users can view email sends"
  ON email_sends
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to insert/update email sends
CREATE POLICY "Service role can manage email sends"
  ON email_sends
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_email_sends_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_sends_updated_at
  BEFORE UPDATE ON email_sends
  FOR EACH ROW
  EXECUTE FUNCTION update_email_sends_updated_at();

-- ============================================
-- ADD recipient_list_ids TO CAMPAIGNS TABLE
-- ============================================
-- This adds the column if it doesn't already exist

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'recipient_list_ids'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN recipient_list_ids UUID[] DEFAULT '{}';
  END IF;
END $$;
