-- Summer Residency INITIAL CONTACT MAP did not stop on Contact Response or
-- Follow Up, unlike the University and UK Gap maps, which both do. A Summer
-- player who reached either stage by any route other than the pipelines board
-- (which stops every active sequence itself) kept receiving first-contact
-- emails, and on Follow Up got the FOLLOW UP MAP on top of them.
--
-- Add the two stages to its stop list, matched by name within the
-- automation's own pipeline. Idempotent: stages already listed are not added
-- twice.
UPDATE automations a
SET stop_on_stage_ids = (
  SELECT array_agg(DISTINCT x)
  FROM unnest(
    COALESCE(a.stop_on_stage_ids, '{}'::uuid[]) ||
    ARRAY(
      SELECT ps.id FROM pipeline_stages ps
      WHERE ps.pipeline_id = a.pipeline_id
        AND ps.name IN ('Contact Response', 'Follow Up')
    )
  ) AS x
)
WHERE a.name = 'Summer Residency INITIAL CONTACT MAP';
