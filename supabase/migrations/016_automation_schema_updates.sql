-- Migration: Add automation_type, trigger_type, and config columns to automations table
-- These columns enable support for different automation types with configurable options

-- Add automation_type column with CHECK constraint
ALTER TABLE automations ADD COLUMN IF NOT EXISTS automation_type TEXT 
  CHECK (automation_type IN ('deal_creation', 'initial_contact', 'follow_up', 'custom'));

-- Add trigger_type column with CHECK constraint  
ALTER TABLE automations ADD COLUMN IF NOT EXISTS trigger_type TEXT
  CHECK (trigger_type IN ('form_submission', 'enters_stage', 'stage_change'));

-- Add config JSONB column for flexible configuration storage
ALTER TABLE automations ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';

-- Add exit_on_reply boolean if not exists (for backwards compatibility)
ALTER TABLE automations ADD COLUMN IF NOT EXISTS exit_on_reply BOOLEAN DEFAULT true;

-- Backfill existing automations with sensible defaults
-- Set automation_type based on existing data patterns
UPDATE automations 
SET automation_type = 'initial_contact' 
WHERE automation_type IS NULL;

-- Set trigger_type based on trigger_stage_id presence
UPDATE automations 
SET trigger_type = 'enters_stage' 
WHERE trigger_type IS NULL AND trigger_stage_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN automations.automation_type IS 'Type of automation: deal_creation, initial_contact, follow_up, or custom';
COMMENT ON COLUMN automations.trigger_type IS 'What triggers the automation: form_submission, enters_stage, or stage_change';
COMMENT ON COLUMN automations.config IS 'JSON configuration including email templates, wait times, round-robin settings, field mappings';
COMMENT ON COLUMN automations.exit_on_reply IS 'Whether to stop automation when contact replies to an email';
