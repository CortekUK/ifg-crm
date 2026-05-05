-- Collapse the "Initial Contact" stage into "Initial Lead" in every
-- pipeline that currently has both. The team treats them as one stage
-- in practice (deal lands → first-touch email goes out from the same
-- column), and the old two-stage shape was producing duplicate rows /
-- confusing reports.
--
-- For each affected pipeline we:
--   1. Repoint deals.current_stage_id from Initial Contact → Initial Lead
--   2. Repoint automations.trigger_stage_id similarly
--   3. Repoint automation_steps.target_stage_id similarly
--   4. Repoint deal_stage_history.from_stage_id / to_stage_id similarly
--   5. Rewrite any automations.stop_on_stage_ids arrays that reference the
--      old stage UUID
--   6. Delete the now-orphaned Initial Contact pipeline_stages row
--
-- Pipelines that have only "Initial Contact" (no "Initial Lead") are
-- left alone — those weren't created from the default template and we
-- don't want to silently delete the recruiter's only lead-stage column.
-- The display_order for the surviving stages is left as-is so we don't
-- fight the (pipeline_id, display_order) UNIQUE constraint; a gap in the
-- ordering doesn't affect the UI, which sorts by display_order anyway.

DO $$
DECLARE
  rec RECORD;
  initial_lead_id UUID;
  initial_contact_id UUID;
BEGIN
  FOR rec IN (
    SELECT DISTINCT p.id AS pipeline_id
    FROM pipelines p
    JOIN pipeline_stages s_lead
      ON s_lead.pipeline_id = p.id AND s_lead.name = 'Initial Lead'
    JOIN pipeline_stages s_contact
      ON s_contact.pipeline_id = p.id AND s_contact.name = 'Initial Contact'
  ) LOOP
    SELECT id INTO initial_lead_id
    FROM pipeline_stages
    WHERE pipeline_id = rec.pipeline_id AND name = 'Initial Lead'
    LIMIT 1;

    SELECT id INTO initial_contact_id
    FROM pipeline_stages
    WHERE pipeline_id = rec.pipeline_id AND name = 'Initial Contact'
    LIMIT 1;

    -- Move deals over.
    UPDATE deals
    SET current_stage_id = initial_lead_id
    WHERE current_stage_id = initial_contact_id;

    -- Move automation triggers.
    UPDATE automations
    SET trigger_stage_id = initial_lead_id
    WHERE trigger_stage_id = initial_contact_id;

    -- Move automation step targets (e.g. move_to_stage steps).
    UPDATE automation_steps
    SET target_stage_id = initial_lead_id
    WHERE target_stage_id = initial_contact_id;

    -- Move stage-change history (so reports keep linking to a stage).
    UPDATE deal_stage_history
    SET from_stage_id = initial_lead_id
    WHERE from_stage_id = initial_contact_id;

    UPDATE deal_stage_history
    SET to_stage_id = initial_lead_id
    WHERE to_stage_id = initial_contact_id;

    -- Rewrite any stop_on_stage_ids arrays containing the old UUID. We
    -- replace the element rather than append, then dedupe via array_agg
    -- DISTINCT in case the Initial Lead UUID was already present.
    UPDATE automations
    SET stop_on_stage_ids = (
      SELECT ARRAY(
        SELECT DISTINCT
          CASE WHEN x = initial_contact_id THEN initial_lead_id ELSE x END
        FROM unnest(stop_on_stage_ids) AS t(x)
      )
    )
    WHERE initial_contact_id = ANY(stop_on_stage_ids);

    -- Now safe to drop the old stage row.
    DELETE FROM pipeline_stages WHERE id = initial_contact_id;
  END LOOP;
END $$;
