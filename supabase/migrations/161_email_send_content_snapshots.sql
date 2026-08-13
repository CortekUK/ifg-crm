-- Preserve the exact, merge-tag-resolved content that was handed to the
-- email provider. Templates and contact fields can change after a send, so
-- the activity feed must not reconstruct historical messages from live data.
ALTER TABLE email_sends
  ADD COLUMN IF NOT EXISTS body_html TEXT,
  ADD COLUMN IF NOT EXISTS body_text TEXT;

COMMENT ON COLUMN email_sends.body_html IS
  'Immutable snapshot of the rendered HTML submitted to the email provider.';
COMMENT ON COLUMN email_sends.body_text IS
  'Immutable snapshot of the rendered plain-text content, when available.';
