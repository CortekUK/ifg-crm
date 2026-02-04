-- Migration: Campaign Sending Support
-- Adds tracking columns for campaign processing

-- Add tracking columns to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS total_recipients INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS processed_recipients INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS last_processed_at TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Create index for efficient campaign processing queries
CREATE INDEX IF NOT EXISTS idx_campaigns_processing
  ON campaigns(status, scheduled_at)
  WHERE status IN ('scheduled', 'sending');

-- Add service role policy for campaign_recipients table to allow edge functions to insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Allow service role full access'
    AND tablename = 'campaign_recipients'
  ) THEN
    CREATE POLICY "Allow service role full access"
      ON campaign_recipients
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
