-- Add pipeline_id to campaigns (NULL = generic campaign)
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_pipeline_id ON campaigns(pipeline_id);

-- Add pipeline_id to email_replies for tracking (sms_messages already has this)
ALTER TABLE email_replies
ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_replies_pipeline_id ON email_replies(pipeline_id);
