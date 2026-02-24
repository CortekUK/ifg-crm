-- Add missing updated_at column to email_sends
-- The BEFORE UPDATE trigger references this column but it doesn't exist,
-- causing all updates to fail silently.
ALTER TABLE email_sends ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
