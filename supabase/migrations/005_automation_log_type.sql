-- ============================================
-- Add log_type column to automation_logs
-- ============================================
-- This allows us to distinguish between different types of log entries

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'automation_logs' AND column_name = 'log_type'
  ) THEN
    ALTER TABLE automation_logs ADD COLUMN log_type TEXT DEFAULT 'step_executed';
  END IF;
END $$;

-- Add index for log_type
CREATE INDEX IF NOT EXISTS idx_automation_logs_log_type ON automation_logs(log_type);

-- ============================================
-- Add stats column to automation_steps
-- ============================================
-- Stores aggregated stats like sent, opened, clicked counts

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'automation_steps' AND column_name = 'stats'
  ) THEN
    ALTER TABLE automation_steps ADD COLUMN stats JSONB DEFAULT '{}';
  END IF;
END $$;

-- ============================================
-- Create function to calculate campaign email stats
-- ============================================

CREATE OR REPLACE FUNCTION calculate_campaign_email_stats(p_campaign_id UUID)
RETURNS TABLE (
  total_sent BIGINT,
  total_delivered BIGINT,
  total_opened BIGINT,
  total_clicked BIGINT,
  total_bounced BIGINT,
  total_failed BIGINT,
  open_rate NUMERIC,
  click_rate NUMERIC,
  click_to_open_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status != 'failed') AS total_sent,
    COUNT(*) FILTER (WHERE status IN ('delivered', 'opened', 'clicked')) AS total_delivered,
    COUNT(*) FILTER (WHERE opened_at IS NOT NULL) AS total_opened,
    COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) AS total_clicked,
    COUNT(*) FILTER (WHERE status = 'bounced') AS total_bounced,
    COUNT(*) FILTER (WHERE status = 'failed') AS total_failed,
    CASE 
      WHEN COUNT(*) FILTER (WHERE status != 'failed') > 0 
      THEN ROUND((COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::NUMERIC / COUNT(*) FILTER (WHERE status != 'failed')) * 100, 2)
      ELSE 0
    END AS open_rate,
    CASE 
      WHEN COUNT(*) FILTER (WHERE status != 'failed') > 0 
      THEN ROUND((COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::NUMERIC / COUNT(*) FILTER (WHERE status != 'failed')) * 100, 2)
      ELSE 0
    END AS click_rate,
    CASE 
      WHEN COUNT(*) FILTER (WHERE opened_at IS NOT NULL) > 0 
      THEN ROUND((COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::NUMERIC / COUNT(*) FILTER (WHERE opened_at IS NOT NULL)) * 100, 2)
      ELSE 0
    END AS click_to_open_rate
  FROM email_sends
  WHERE campaign_id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Create view for campaign email stats
-- ============================================

CREATE OR REPLACE VIEW campaign_email_stats AS
SELECT
  campaign_id,
  COUNT(*) FILTER (WHERE status != 'failed') AS total_sent,
  COUNT(*) FILTER (WHERE status IN ('delivered', 'opened', 'clicked')) AS total_delivered,
  COUNT(*) FILTER (WHERE opened_at IS NOT NULL) AS total_opened,
  COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) AS total_clicked,
  COUNT(*) FILTER (WHERE status = 'bounced') AS total_bounced,
  COUNT(*) FILTER (WHERE status = 'complained') AS total_complained,
  COUNT(*) FILTER (WHERE status = 'failed') AS total_failed,
  CASE 
    WHEN COUNT(*) FILTER (WHERE status != 'failed') > 0 
    THEN ROUND((COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::NUMERIC / COUNT(*) FILTER (WHERE status != 'failed')) * 100, 2)
    ELSE 0
  END AS open_rate,
  CASE 
    WHEN COUNT(*) FILTER (WHERE status != 'failed') > 0 
    THEN ROUND((COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::NUMERIC / COUNT(*) FILTER (WHERE status != 'failed')) * 100, 2)
    ELSE 0
  END AS click_rate,
  CASE 
    WHEN COUNT(*) FILTER (WHERE opened_at IS NOT NULL) > 0 
    THEN ROUND((COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::NUMERIC / COUNT(*) FILTER (WHERE opened_at IS NOT NULL)) * 100, 2)
    ELSE 0
  END AS click_to_open_rate
FROM email_sends
WHERE campaign_id IS NOT NULL
GROUP BY campaign_id;
