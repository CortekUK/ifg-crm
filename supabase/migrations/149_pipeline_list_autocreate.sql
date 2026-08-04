-- Make programme/season lists fully hands-off.
--
-- The deal→pipeline-list sync trigger (sync_deal_to_pipeline_list) previously
-- only added the contact to a list that was ALREADY linked to the deal's
-- pipeline (lists.source_pipeline_id); if a pipeline had no linked list it did
-- nothing. Now, when a deal lands in a pipeline that has no linked list, it
-- auto-creates a list named after the pipeline and links it — so a brand-new
-- programme needs zero manual list setup. If an unlinked list with the same
-- name already exists, it links that one instead of creating a duplicate.
-- Setting source_pipeline_id keeps every future deal in that pipeline syncing
-- to the same list (no off-year duplicates).

CREATE OR REPLACE FUNCTION public.sync_deal_to_pipeline_list()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_list_id UUID;
  v_pipeline_name TEXT;
  v_pipeline_sport TEXT;
BEGIN
  -- Find the list already linked to this deal's pipeline.
  SELECT id INTO v_list_id
  FROM lists
  WHERE source_pipeline_id = NEW.pipeline_id
  LIMIT 1;

  -- No linked list yet: create one named after the pipeline and link it (or
  -- adopt an existing same-named list) so the programme list is automatic.
  IF v_list_id IS NULL AND NEW.pipeline_id IS NOT NULL THEN
    SELECT name, sport INTO v_pipeline_name, v_pipeline_sport
    FROM pipelines WHERE id = NEW.pipeline_id;

    IF v_pipeline_name IS NOT NULL THEN
      SELECT id INTO v_list_id FROM lists WHERE name = v_pipeline_name LIMIT 1;
      IF v_list_id IS NULL THEN
        INSERT INTO lists (name, description, sport, is_dynamic, source_pipeline_id)
        VALUES (v_pipeline_name,
                'Auto-created for the ' || v_pipeline_name || ' pipeline',
                COALESCE(v_pipeline_sport, 'football'), false, NEW.pipeline_id)
        RETURNING id INTO v_list_id;
      ELSE
        UPDATE lists SET source_pipeline_id = NEW.pipeline_id
        WHERE id = v_list_id AND source_pipeline_id IS NULL;
      END IF;
    END IF;
  END IF;

  IF v_list_id IS NOT NULL THEN
    INSERT INTO contact_lists (contact_id, list_id, added_at)
    VALUES (NEW.contact_id, v_list_id, NOW())
    ON CONFLICT (contact_id, list_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
