-- Migration to fix deal stage references
-- The deals have current_stage_id values that don't exist in pipeline_stages
-- This updates all deals to use the first valid stage from their pipeline

-- First, temporarily disable the FK constraint
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_current_stage_id_fkey;

-- Update deals to use the first stage from their pipeline
UPDATE deals d
SET current_stage_id = (
  SELECT ps.id 
  FROM pipeline_stages ps 
  WHERE ps.pipeline_id = d.pipeline_id 
  ORDER BY ps.display_order ASC 
  LIMIT 1
)
WHERE d.current_stage_id NOT IN (SELECT id FROM pipeline_stages);

-- For any deals where we couldn't find a matching stage, use any valid stage
UPDATE deals d
SET current_stage_id = (
  SELECT ps.id 
  FROM pipeline_stages ps 
  ORDER BY ps.created_at ASC 
  LIMIT 1
)
WHERE d.current_stage_id NOT IN (SELECT id FROM pipeline_stages)
  AND EXISTS (SELECT 1 FROM pipeline_stages);

-- Re-add the FK constraint (without NOT VALID so it validates existing data)
ALTER TABLE deals 
ADD CONSTRAINT deals_current_stage_id_fkey 
FOREIGN KEY (current_stage_id) 
REFERENCES pipeline_stages(id);

-- Log what was fixed
DO $$
DECLARE
  fixed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fixed_count 
  FROM deals 
  WHERE current_stage_id IN (SELECT id FROM pipeline_stages);
  RAISE NOTICE 'Deals with valid stage references: %', fixed_count;
END $$;
