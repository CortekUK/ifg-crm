-- Add a 'dead' stage_type to pipeline_stages so the default-stages list
-- can include a "Dead" stage alongside the existing "Dormant" one (used
-- for leads that are unrecoverable vs. ones that have just gone quiet).
--
-- Postgres doesn't let you alter a CHECK constraint in place, so we drop
-- and recreate. The constraint name comes from the original schema.

ALTER TABLE pipeline_stages
  DROP CONSTRAINT IF EXISTS pipeline_stages_stage_type_check;

ALTER TABLE pipeline_stages
  ADD CONSTRAINT pipeline_stages_stage_type_check
  CHECK (
    stage_type IN (
      'lead',
      'contact',
      'meeting',
      'follow_up',
      'documents',
      'applied',
      'offer',
      'payment',
      'completed',
      'lost',
      'dormant',
      'dead'
    )
  );
