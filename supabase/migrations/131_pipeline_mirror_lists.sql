-- Pipeline-mirror lists. Every pipeline gets one auto-populated list
-- named after it (e.g. "UCLan 2026" pipeline → "UCLan 2026" list). The
-- list collects every contact whose deal lands in that pipeline, so
-- recruiters have a one-click view of "everyone we've ever pursued for
-- programme X" without writing rules manually.
--
-- Three pieces:
--   1. Schema:  add lists.source_pipeline_id (FK to pipelines).
--   2. Triggers:
--        a. AFTER INSERT ON pipelines  → create the matching list.
--        b. AFTER INSERT ON deals      → upsert the contact onto the list.
--        c. AFTER UPDATE ON pipelines  → keep list.name in sync with the pipeline.
--   3. Backfill: create lists for every existing pipeline, then add
--      contacts of every existing deal to the matching list.

-- ── 1. Schema ────────────────────────────────────────────────────────
ALTER TABLE lists
  ADD COLUMN IF NOT EXISTS source_pipeline_id UUID
    REFERENCES pipelines(id) ON DELETE CASCADE;

-- One list per pipeline; partial unique index so non-pipeline lists
-- (the existing static + dynamic ones) aren't constrained.
CREATE UNIQUE INDEX IF NOT EXISTS idx_lists_source_pipeline_unique
  ON lists(source_pipeline_id)
  WHERE source_pipeline_id IS NOT NULL;

-- ── 2a. Auto-create list when a pipeline is added ───────────────────
CREATE OR REPLACE FUNCTION create_pipeline_mirror_list()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO lists (name, description, sport, is_dynamic, source_pipeline_id)
  VALUES (
    NEW.name,
    'Auto-populated: every contact whose deal lands in the ' || NEW.name || ' pipeline.',
    NEW.sport,
    true,
    NEW.id
  )
  ON CONFLICT DO NOTHING; -- idempotent against the partial unique index
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pipeline_create_mirror_list ON pipelines;
CREATE TRIGGER pipeline_create_mirror_list
AFTER INSERT ON pipelines
FOR EACH ROW
EXECUTE FUNCTION create_pipeline_mirror_list();

-- ── 2b. When a deal is created, add its contact to the pipeline list ─
CREATE OR REPLACE FUNCTION sync_deal_to_pipeline_list()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_list_id UUID;
BEGIN
  SELECT id INTO v_list_id
  FROM lists
  WHERE source_pipeline_id = NEW.pipeline_id
  LIMIT 1;

  IF v_list_id IS NOT NULL THEN
    INSERT INTO contact_lists (contact_id, list_id, added_at)
    VALUES (NEW.contact_id, v_list_id, NOW())
    ON CONFLICT (contact_id, list_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deal_sync_to_pipeline_list ON deals;
CREATE TRIGGER deal_sync_to_pipeline_list
AFTER INSERT ON deals
FOR EACH ROW
EXECUTE FUNCTION sync_deal_to_pipeline_list();

-- ── 2c. Keep list name in sync when pipeline is renamed ──────────────
CREATE OR REPLACE FUNCTION rename_pipeline_mirror_list()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE lists
    SET name        = NEW.name,
        description = 'Auto-populated: every contact whose deal lands in the ' || NEW.name || ' pipeline.',
        updated_at  = NOW()
    WHERE source_pipeline_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pipeline_rename_mirror_list ON pipelines;
CREATE TRIGGER pipeline_rename_mirror_list
AFTER UPDATE OF name ON pipelines
FOR EACH ROW
EXECUTE FUNCTION rename_pipeline_mirror_list();

-- ── 3. Backfill existing pipelines + deals ───────────────────────────
-- Lists for any pipeline that doesn't yet have a mirror list.
INSERT INTO lists (name, description, sport, is_dynamic, source_pipeline_id)
SELECT
  p.name,
  'Auto-populated: every contact whose deal lands in the ' || p.name || ' pipeline.',
  p.sport,
  true,
  p.id
FROM pipelines p
WHERE NOT EXISTS (
  SELECT 1 FROM lists WHERE source_pipeline_id = p.id
);

-- Contacts of every existing deal land on their pipeline's mirror list.
INSERT INTO contact_lists (contact_id, list_id, added_at)
SELECT DISTINCT d.contact_id, l.id, NOW()
FROM deals d
JOIN lists l ON l.source_pipeline_id = d.pipeline_id
ON CONFLICT (contact_id, list_id) DO NOTHING;
