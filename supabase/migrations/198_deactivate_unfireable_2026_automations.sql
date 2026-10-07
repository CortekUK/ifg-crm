-- Switch off six 2026 automations that are flagged active but cannot fire.
--
-- Each one triggers on `enters_stage` yet has NO pipeline and NO trigger
-- stage, so there is no stage for a deal to enter. All six were created on
-- 2026-05-06 and have enrolled zero deals in the five months since:
--
--   UCLAN 2026 invoice generation
--   UCLAN 2026  Documents Reminder 1 week
--   UCLan 2026 Arrival Player Portal
--   UK Gap 2026 Invoice generation
--   UK Gap 2026 Documents reminder 1 Week
--   UK Gap 2026 Arrival Player Portal
--
-- They are 2026-season leftovers sitting beside the 2027 pipelines. Being
-- listed as active, they get opened by mistake — the invoice pair in
-- particular, where the editor correctly reports "no active form-submission
-- automation ties this pipeline to a programme" and that reads as a pricing
-- bug rather than as an unconfigured automation.
--
-- WHY NOT GIVE THEM A PIPELINE INSTEAD
--
-- Because UK GAP 2027 and UNIVERSITY 2027 already have their own invoice
-- automation on the Send Invoice stage. A second one on the same stage would
-- raise a second invoice for the same deal — which is exactly QA-23, the
-- "re-entering Send Invoice raised a second real invoice" bug. Pointing these
-- at a live pipeline would reintroduce it.
--
-- Deactivating keeps the configuration intact, so anything worth reusing for a
-- future season is still there. Reversible: switch one back on in the UI.
--
-- Scoped by what makes them inert rather than by name, so it cannot catch a
-- working automation: active, enters_stage, no pipeline, no trigger stage, and
-- never enrolled anything.

UPDATE automations a
SET is_active = false,
    updated_at = NOW()
WHERE a.is_active
  AND a.trigger_type = 'enters_stage'
  AND a.pipeline_id IS NULL
  AND a.trigger_stage_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM automation_enrollments e WHERE e.automation_id = a.id
  );
