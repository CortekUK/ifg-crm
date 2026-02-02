-- Migration: Add missing columns to deals and payments tables
-- Fixes 400 errors on queries that expect these columns

-- ============================================
-- 1. ADD STATUS COLUMN TO DEALS TABLE
-- ============================================
-- The status column indicates the current state of the deal
-- Previously this was derived from won_at/lost_at but queries expect a status column
ALTER TABLE deals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost'));

-- Backfill status based on existing won_at/lost_at values
UPDATE deals SET status = 'won' WHERE won_at IS NOT NULL AND status IS NULL;
UPDATE deals SET status = 'lost' WHERE lost_at IS NOT NULL AND status IS NULL;
UPDATE deals SET status = 'active' WHERE won_at IS NULL AND lost_at IS NULL AND status IS NULL;

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);

-- Add value column as alias for deal_value (some queries use 'value')
ALTER TABLE deals ADD COLUMN IF NOT EXISTS value DECIMAL(10,2);

-- Sync value with deal_value for existing records
UPDATE deals SET value = deal_value WHERE value IS NULL;

-- Add stage_id as alias for current_stage_id (some queries use 'stage_id')
ALTER TABLE deals ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES pipeline_stages(id);

-- Sync stage_id with current_stage_id for existing records
UPDATE deals SET stage_id = current_stage_id WHERE stage_id IS NULL;

-- Add owner_id as alias for deal_owner_id (some queries use 'owner_id')
ALTER TABLE deals ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id);

-- Sync owner_id with deal_owner_id for existing records
UPDATE deals SET owner_id = deal_owner_id WHERE owner_id IS NULL;

-- ============================================
-- 2. ADD STATUS COLUMN TO PAYMENTS TABLE
-- ============================================
-- The status column indicates if the payment was successful, failed, pending, etc.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'successful' CHECK (status IN ('pending', 'successful', 'failed', 'refunded'));

-- All existing payments are assumed to be successful
UPDATE payments SET status = 'successful' WHERE status IS NULL;

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- ============================================
-- 3. ADD TRIGGER TO KEEP ALIAS COLUMNS IN SYNC
-- ============================================

-- Function to sync deal alias columns
CREATE OR REPLACE FUNCTION sync_deal_alias_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync value with deal_value
  IF NEW.deal_value IS DISTINCT FROM OLD.deal_value THEN
    NEW.value := NEW.deal_value;
  ELSIF NEW.value IS DISTINCT FROM OLD.value THEN
    NEW.deal_value := NEW.value;
  END IF;
  
  -- Sync stage_id with current_stage_id
  IF NEW.current_stage_id IS DISTINCT FROM OLD.current_stage_id THEN
    NEW.stage_id := NEW.current_stage_id;
  ELSIF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    NEW.current_stage_id := NEW.stage_id;
  END IF;
  
  -- Sync owner_id with deal_owner_id
  IF NEW.deal_owner_id IS DISTINCT FROM OLD.deal_owner_id THEN
    NEW.owner_id := NEW.deal_owner_id;
  ELSIF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    NEW.deal_owner_id := NEW.owner_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updates
DROP TRIGGER IF EXISTS trigger_sync_deal_aliases ON deals;
CREATE TRIGGER trigger_sync_deal_aliases
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION sync_deal_alias_columns();

-- Function to set alias columns on insert
CREATE OR REPLACE FUNCTION set_deal_alias_columns_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Set value from deal_value if not provided
  IF NEW.value IS NULL THEN
    NEW.value := NEW.deal_value;
  END IF;
  
  -- Set stage_id from current_stage_id if not provided
  IF NEW.stage_id IS NULL THEN
    NEW.stage_id := NEW.current_stage_id;
  END IF;
  
  -- Set owner_id from deal_owner_id if not provided
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := NEW.deal_owner_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for inserts
DROP TRIGGER IF EXISTS trigger_set_deal_aliases_insert ON deals;
CREATE TRIGGER trigger_set_deal_aliases_insert
  BEFORE INSERT ON deals
  FOR EACH ROW
  EXECUTE FUNCTION set_deal_alias_columns_on_insert();

-- ============================================
-- 4. ADD COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON COLUMN deals.status IS 'Current status of the deal: active, won, or lost';
COMMENT ON COLUMN deals.value IS 'Alias for deal_value - the monetary value of the deal';
COMMENT ON COLUMN deals.stage_id IS 'Alias for current_stage_id - the current pipeline stage';
COMMENT ON COLUMN deals.owner_id IS 'Alias for deal_owner_id - the user who owns this deal';
COMMENT ON COLUMN payments.status IS 'Payment status: pending, successful, failed, or refunded';
