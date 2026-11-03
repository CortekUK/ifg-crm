-- A "Rescheduled Zoom" stage, right after Zoom Scheduled, on every pipeline.
--
-- Type 'meeting', the same as Zoom Scheduled: the deal is still heading for a
-- call, so the dashboard's "in a call stage" figure should keep counting it.
--
-- The first-contact automations stop when a deal reaches Zoom Scheduled. They
-- list that stage by id, so the new one is added wherever it appears, or a deal
-- going straight to Rescheduled Zoom would keep getting first-contact emails.

DO $$
DECLARE
  zoom RECORD;
  new_stage uuid;
BEGIN
  FOR zoom IN
    SELECT s.id, s.pipeline_id, s.display_order, s.color
    FROM pipeline_stages s
    WHERE s.name = 'Zoom Scheduled'
      AND NOT EXISTS (
        SELECT 1 FROM pipeline_stages x
        WHERE x.pipeline_id = s.pipeline_id AND x.name = 'Rescheduled Zoom'
      )
  LOOP
    -- Two steps: (pipeline_id, display_order) is unique and checked row by row.
    UPDATE pipeline_stages SET display_order = display_order + 10000
    WHERE pipeline_id = zoom.pipeline_id AND display_order > zoom.display_order;
    UPDATE pipeline_stages SET display_order = display_order - 9999
    WHERE pipeline_id = zoom.pipeline_id AND display_order > 10000;

    INSERT INTO pipeline_stages (pipeline_id, name, stage_type, triggers_automation, display_order, color)
    VALUES (zoom.pipeline_id, 'Rescheduled Zoom', 'meeting', false, zoom.display_order + 1, zoom.color)
    RETURNING id INTO new_stage;

    UPDATE automations SET stop_on_stage_ids = array_append(stop_on_stage_ids, new_stage)
    WHERE zoom.id = ANY (stop_on_stage_ids);
  END LOOP;
END $$;
