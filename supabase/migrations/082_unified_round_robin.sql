-- Migration 082: Unified round-robin cursor table.
--
-- Supersedes two parallel systems:
--   * round_robin_state (from 007) — keyed by automation_id
--   * manual_round_robin_state (from 037) — keyed by pipeline_key ('manual_<uuid>')
--
-- The two had ~95% identical plpgsql logic. Unifying them behind one
-- (context_type, context_id) key lets new contexts (e.g. bulk enrollment,
-- round-robin within a deal stage) register without another table/RPC pair.
--
-- This migration is strictly additive: the old tables and old RPCs stay
-- intact so the system keeps working during the code-side rollout window.
-- Migration 083 (separate, later) drops them once every call site has moved.
--
-- Idempotent: re-running is safe if a partial earlier run created the table
-- or some of the policies. Columns from the legacy tables are referenced by
-- name only where they are known to always exist — updated_at is omitted
-- from the SELECTs because at least one production database is missing it
-- despite migration 007 defining it (schema drift against the repo).

CREATE TABLE IF NOT EXISTS round_robin_cursors (
  context_type TEXT NOT NULL,
  context_id UUID NOT NULL,
  last_assigned_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  last_assigned_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (context_type, context_id)
);

ALTER TABLE round_robin_cursors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "round_robin_cursors select" ON round_robin_cursors;
CREATE POLICY "round_robin_cursors select" ON round_robin_cursors
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "round_robin_cursors all" ON round_robin_cursors;
CREATE POLICY "round_robin_cursors all" ON round_robin_cursors
  FOR ALL USING (true);

-- ----------------------------------------------------------------------
-- Backfill from the legacy tables. ON CONFLICT DO NOTHING so re-running
-- this migration is idempotent against any rows inserted via the new RPC
-- after the initial backfill. updated_at is not referenced on the source
-- side (see header comment); the target column's DEFAULT now() fills it.
-- ----------------------------------------------------------------------

INSERT INTO round_robin_cursors (
  context_type, context_id, last_assigned_user_id, last_assigned_at
)
SELECT 'automation', automation_id, last_assigned_user_id, last_assigned_at
FROM round_robin_state
ON CONFLICT DO NOTHING;

-- manual_round_robin_state uses pipeline_key = 'manual_' || pipeline_id. We
-- strip the prefix and only include rows where the remainder looks like a
-- valid UUID, so any malformed keys are silently skipped rather than crashing
-- the migration.
INSERT INTO round_robin_cursors (
  context_type, context_id, last_assigned_user_id, last_assigned_at
)
SELECT
  'manual_pipeline',
  substring(pipeline_key FROM 8)::uuid,
  last_assigned_user_id,
  last_assigned_at
FROM manual_round_robin_state
WHERE pipeline_key LIKE 'manual_%'
  AND substring(pipeline_key FROM 8) ~ '^[0-9a-fA-F-]{36}$'
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------
-- Unified RPC. Replaces get_next_round_robin_user (007) and
-- get_next_round_robin_user_manual (037). The rotation algorithm is
-- identical — this is a consolidation, not a behaviour change.
-- ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION round_robin_next(
  p_context_type TEXT,
  p_context_id UUID,
  p_user_ids UUID[]
) RETURNS UUID AS $$
DECLARE
  v_last_user_id UUID;
  v_last_index INTEGER;
  v_next_index INTEGER;
  v_next_user_id UUID;
BEGIN
  IF p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT last_assigned_user_id INTO v_last_user_id
  FROM round_robin_cursors
  WHERE context_type = p_context_type AND context_id = p_context_id;

  IF v_last_user_id IS NULL THEN
    v_next_user_id := p_user_ids[1];
  ELSE
    v_last_index := array_position(p_user_ids, v_last_user_id);
    IF v_last_index IS NULL THEN
      v_next_index := 1;
    ELSE
      v_next_index := v_last_index + 1;
      IF v_next_index > array_length(p_user_ids, 1) THEN
        v_next_index := 1;
      END IF;
    END IF;
    v_next_user_id := p_user_ids[v_next_index];
  END IF;

  INSERT INTO round_robin_cursors (
    context_type, context_id, last_assigned_user_id, last_assigned_at, updated_at
  ) VALUES (
    p_context_type, p_context_id, v_next_user_id, now(), now()
  )
  ON CONFLICT (context_type, context_id) DO UPDATE SET
    last_assigned_user_id = v_next_user_id,
    last_assigned_at = now(),
    updated_at = now();

  RETURN v_next_user_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE round_robin_cursors IS
  'Unified round-robin cursor per (context_type, context_id). Supersedes round_robin_state (automation) and manual_round_robin_state (manual_pipeline). Populated by the round_robin_next RPC.';

COMMENT ON FUNCTION round_robin_next IS
  'Returns the next user id in the rotation for (context_type, context_id) and advances the cursor. Single entry point replacing get_next_round_robin_user and get_next_round_robin_user_manual.';
