-- Migration: ensure every FK that references pipelines or pipeline_stages
-- has the correct ON DELETE behaviour, so deleting a pipeline (which cascades
-- to its stages) doesn't fail with FK violations partway through.
--
-- Migration 104 fixed automations/campaigns/sms_messages → pipelines. This
-- migration handles the stage-level FKs that drift in production.
--
-- Idempotent — every constraint is dropped if exists, then re-added.

-- ============================================================
-- automations.trigger_stage_id → pipeline_stages.id  (SET NULL)
-- ============================================================
ALTER TABLE automations
  DROP CONSTRAINT IF EXISTS automations_trigger_stage_id_fkey;
ALTER TABLE automations
  ADD CONSTRAINT automations_trigger_stage_id_fkey
  FOREIGN KEY (trigger_stage_id)
  REFERENCES pipeline_stages(id)
  ON DELETE SET NULL;

-- ============================================================
-- automations.exit_to_stage_id → pipeline_stages.id  (SET NULL)
-- (added in migration 089, recreate to be safe)
-- ============================================================
ALTER TABLE automations
  DROP CONSTRAINT IF EXISTS automations_exit_to_stage_id_fkey;
ALTER TABLE automations
  ADD CONSTRAINT automations_exit_to_stage_id_fkey
  FOREIGN KEY (exit_to_stage_id)
  REFERENCES pipeline_stages(id)
  ON DELETE SET NULL;

-- ============================================================
-- automations.no_reply_stage_id → pipeline_stages.id  (SET NULL)
-- (added in migration 091, recreate to be safe)
-- ============================================================
ALTER TABLE automations
  DROP CONSTRAINT IF EXISTS automations_no_reply_stage_id_fkey;
ALTER TABLE automations
  ADD CONSTRAINT automations_no_reply_stage_id_fkey
  FOREIGN KEY (no_reply_stage_id)
  REFERENCES pipeline_stages(id)
  ON DELETE SET NULL;

-- ============================================================
-- automation_steps.target_stage_id → pipeline_stages.id  (SET NULL)
-- ============================================================
ALTER TABLE automation_steps
  DROP CONSTRAINT IF EXISTS automation_steps_target_stage_id_fkey;
ALTER TABLE automation_steps
  ADD CONSTRAINT automation_steps_target_stage_id_fkey
  FOREIGN KEY (target_stage_id)
  REFERENCES pipeline_stages(id)
  ON DELETE SET NULL;

-- ============================================================
-- deals.current_stage_id → pipeline_stages.id  (CASCADE)
-- The original schema declared this as NO ACTION (default). When a pipeline
-- cascade-deletes its stages, deals still pointing at those stages cause an
-- FK violation. We delete deals before the pipeline anyway in the force-
-- delete path, but if the cascade ever races (or someone runs raw SQL),
-- CASCADE here keeps things consistent.
-- ============================================================
ALTER TABLE deals
  DROP CONSTRAINT IF EXISTS deals_current_stage_id_fkey;
ALTER TABLE deals
  ADD CONSTRAINT deals_current_stage_id_fkey
  FOREIGN KEY (current_stage_id)
  REFERENCES pipeline_stages(id)
  ON DELETE CASCADE;
