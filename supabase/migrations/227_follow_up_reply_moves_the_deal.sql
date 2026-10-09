-- QA-19 finding 3: a reply stopped the Follow Up emails but left the deal
-- sitting in Follow Up, so the recruiter never saw that the player had
-- answered.
--
-- The template's description claims it "updates the stage". It has no stage
-- step — the move happens through the reply exit goal, and that goal was
-- never set on two of the three live maps:
--
--   SUMMER RESIDENCY 2027 FOLLOW UP MAP   exit stage: none
--   UK GAP FOLLOW UP MAP                  exit stage: none
--   UNIVERSITY OF LANCASHIRE - FOLLOW UP  exit stage: Contact Response
--
-- The editor already defaults this to Contact Response — but only for a NEW
-- automation (`!editingAutomation`), so the maps built before that default
-- existed kept their blank. Same shape as the stop_on_payment and
-- create_portal_account backfills in migrations 199 and 201: the screen shows
-- the intent, the saved rows never got it. All three initial_contact maps
-- already have it, which is why a reply behaves correctly there and not here.
--
-- Scoped deliberately:
--   * follow_up only, and only where the reply exit is actually blank
--   * exit_on_reply must be ON. That excludes the three "Brochure: …" senders,
--     which sync-automations.ts creates with exit_on_reply = false on purpose:
--     they post a brochure link once and are not a conversation, so a reply
--     must not move the card.
--   * the pipeline must actually have a stage named "Contact Response"
--
-- Both the column and the config key are written, because that is what the
-- rows which already work look like, and move_deal_on_enrollment_exit reads
-- COALESCE(column, config key).
--
-- Safe on live data: the move is forward-only for the replied branch (a deal
-- already at or past Contact Response stays put), which is the rule QA-30
-- verified.
--
-- Idempotent.

WITH response_stage AS (
  SELECT s.pipeline_id, s.id AS stage_id
  FROM pipeline_stages s
  WHERE lower(trim(s.name)) = 'contact response'
)
UPDATE automations a
SET exit_to_stage_id = rs.stage_id,
    config = COALESCE(a.config, '{}'::jsonb)
             || jsonb_build_object('exit_to_stage_id', rs.stage_id::text)
FROM response_stage rs
WHERE a.pipeline_id = rs.pipeline_id
  AND a.automation_type = 'follow_up'
  AND COALESCE(a.exit_on_reply, (a.config->>'exit_on_reply')::boolean, true) = true
  AND COALESCE(a.config->>'brochure_send', 'false') <> 'true'
  AND COALESCE(a.exit_to_stage_id, NULLIF(a.config->>'exit_to_stage_id', '')::uuid) IS NULL;
