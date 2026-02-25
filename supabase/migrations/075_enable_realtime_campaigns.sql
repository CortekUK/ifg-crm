-- Enable Supabase Realtime for campaigns and email_sends tables
-- This allows the UI to receive live updates when webhook events update stats

ALTER PUBLICATION supabase_realtime ADD TABLE campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE email_sends;
ALTER PUBLICATION supabase_realtime ADD TABLE sms_sends;
