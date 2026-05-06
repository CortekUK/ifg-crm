-- Add a "Document Collecting" stage to every existing pipeline that has
-- an "Application" stage but doesn't yet have "Document Collecting".
-- The new stage sits ONE slot before Application — recruiters start
-- gathering paperwork (passport, transcripts, etc.) before the formal
-- application is submitted, so the column needs to come first.
--
-- "Reg Form received" further down the funnel is a separate milestone
-- (registration form back from the institution) and is left alone.
--
-- Inserting in the middle of a pipeline is awkward because of the
-- UNIQUE(pipeline_id, display_order) constraint. We can't bulk-bump
-- display_order = display_order + 1 in a single UPDATE — Postgres
-- evaluates the constraint per row and we'd hit a transient duplicate.
-- The two-step trick: negate the orders we need to move, insert the
-- new row at the freed slot, then flip the negatives back (which adds
-- 1 to each).

DO $$
DECLARE
  rec RECORD;
  app_order INTEGER;
BEGIN
  FOR rec IN (
    SELECT DISTINCT p.id AS pipeline_id
    FROM pipelines p
    JOIN pipeline_stages s_app
      ON s_app.pipeline_id = p.id AND s_app.name = 'Application'
    WHERE NOT EXISTS (
      SELECT 1 FROM pipeline_stages
      WHERE pipeline_id = p.id AND name = 'Document Collecting'
    )
  ) LOOP
    SELECT display_order INTO app_order
    FROM pipeline_stages
    WHERE pipeline_id = rec.pipeline_id AND name = 'Application'
    LIMIT 1;

    -- Park stages at and after Application in negative space so the
    -- (pipeline_id, display_order) UNIQUE constraint stays clean while
    -- we insert.  -7, -8, -9, ...  for original 6, 7, 8, ...
    UPDATE pipeline_stages
    SET display_order = -display_order - 1
    WHERE pipeline_id = rec.pipeline_id AND display_order >= app_order;

    -- Insert the new column at the freed slot (Application's old order).
    INSERT INTO pipeline_stages (pipeline_id, name, stage_type, display_order, color)
    VALUES (rec.pipeline_id, 'Document Collecting', 'documents', app_order, '#fb923c');

    -- Flip the parked rows back to positive — this adds exactly 1 to
    -- each of their original orders, opening the gap for the new row.
    UPDATE pipeline_stages
    SET display_order = -display_order
    WHERE pipeline_id = rec.pipeline_id AND display_order < 0;
  END LOOP;
END $$;
