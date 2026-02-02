-- Migration: Fix form_submissions and calendly_events tables
-- Adds missing columns that may not have been created properly

-- Add missing columns to form_submissions if they don't exist
DO $$ 
BEGIN
  -- Add automation_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'form_submissions' AND column_name = 'automation_id'
  ) THEN
    ALTER TABLE form_submissions ADD COLUMN automation_id UUID REFERENCES automations(id) ON DELETE SET NULL;
  END IF;

  -- Add assigned_user_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'form_submissions' AND column_name = 'assigned_user_id'
  ) THEN
    ALTER TABLE form_submissions ADD COLUMN assigned_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create form_submissions indexes
CREATE INDEX IF NOT EXISTS idx_form_submissions_automation_id ON form_submissions(automation_id);

-- Fix calendly_events table - add missing columns
DO $$ 
BEGIN
  -- Add deal_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calendly_events' AND column_name = 'deal_id'
  ) THEN
    ALTER TABLE calendly_events ADD COLUMN deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create calendly_events indexes
CREATE INDEX IF NOT EXISTS idx_calendly_events_deal_id ON calendly_events(deal_id);
