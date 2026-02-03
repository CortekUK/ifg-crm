-- Migration to fix the stage_id foreign key constraint issue
-- The trigger syncs stage_id with current_stage_id, but the FK constraint
-- on stage_id is causing issues when moving deals

-- Drop the problematic FK constraint on stage_id
-- (keeping current_stage_id FK which is the primary reference)
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_stage_id_fkey;

-- Also drop the trigger that syncs stage_id since we're removing its FK
-- The current_stage_id is the authoritative column
DROP TRIGGER IF EXISTS sync_deal_alias_columns_trigger ON deals;
DROP TRIGGER IF EXISTS set_deal_alias_columns_on_insert_trigger ON deals;

-- Recreate a simpler trigger that only syncs value and owner_id (not stage_id)
CREATE OR REPLACE FUNCTION sync_deal_alias_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync value with deal_value
  IF NEW.deal_value IS DISTINCT FROM OLD.deal_value THEN
    NEW.value := NEW.deal_value;
  ELSIF NEW.value IS DISTINCT FROM OLD.value THEN
    NEW.deal_value := NEW.value;
  END IF;
  
  -- Sync owner_id with deal_owner_id
  IF NEW.deal_owner_id IS DISTINCT FROM OLD.deal_owner_id THEN
    NEW.owner_id := NEW.deal_owner_id;
  ELSIF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    NEW.deal_owner_id := NEW.owner_id;
  END IF;
  
  -- Note: stage_id sync removed - current_stage_id is the authoritative column
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger for updates
CREATE TRIGGER sync_deal_alias_columns_trigger
BEFORE UPDATE ON deals
FOR EACH ROW
EXECUTE FUNCTION sync_deal_alias_columns();

-- Recreate simpler insert trigger
CREATE OR REPLACE FUNCTION set_deal_alias_columns_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Set value from deal_value if not provided
  IF NEW.value IS NULL THEN
    NEW.value := NEW.deal_value;
  END IF;
  
  -- Set owner_id from deal_owner_id if not provided
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := NEW.deal_owner_id;
  END IF;
  
  -- Note: stage_id is no longer synced - current_stage_id is authoritative
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_deal_alias_columns_on_insert_trigger
BEFORE INSERT ON deals
FOR EACH ROW
EXECUTE FUNCTION set_deal_alias_columns_on_insert();

-- Add comment explaining the change
COMMENT ON COLUMN deals.stage_id IS 'Deprecated alias - use current_stage_id instead. FK constraint removed due to data sync issues.';
