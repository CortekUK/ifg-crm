-- Migration: restore ON DELETE SET NULL on automations.pipeline_id and
-- campaigns.pipeline_id. The original schema (migration 001 / 041) declared
-- these as ON DELETE SET NULL but in production at least the automations
-- constraint has been observed to violate when deleting a pipeline — likely
-- recreated without SET NULL by a later schema change. Re-create both with
-- the correct cascade behaviour. Idempotent.

-- AUTOMATIONS
ALTER TABLE automations
  DROP CONSTRAINT IF EXISTS automations_pipeline_id_fkey;

ALTER TABLE automations
  ADD CONSTRAINT automations_pipeline_id_fkey
  FOREIGN KEY (pipeline_id)
  REFERENCES pipelines(id)
  ON DELETE SET NULL;

-- CAMPAIGNS
ALTER TABLE campaigns
  DROP CONSTRAINT IF EXISTS campaigns_pipeline_id_fkey;

ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_pipeline_id_fkey
  FOREIGN KEY (pipeline_id)
  REFERENCES pipelines(id)
  ON DELETE SET NULL;

-- SMS_MESSAGES — same fix in case the constraint drifted here too.
ALTER TABLE sms_messages
  DROP CONSTRAINT IF EXISTS sms_messages_pipeline_id_fkey;

ALTER TABLE sms_messages
  ADD CONSTRAINT sms_messages_pipeline_id_fkey
  FOREIGN KEY (pipeline_id)
  REFERENCES pipelines(id)
  ON DELETE SET NULL;
