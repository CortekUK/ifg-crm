-- QA-19 Issue 1: a reply exit stage that can never be applied.
--
-- Since the QA-30 fix a reply only ever moves a deal FORWARD. Contact Response
-- sits at position 3 in every pipeline and Follow Up at position 5, so every
-- Follow Up automation configured to "move the deal to Contact Response on a
-- reply" was pointing at a destination behind it. The emails stopped and the
-- card never moved.
--
-- QA saw it live: two players replied to the UNIVERSITY OF LANCASHIRE FOLLOW
-- UP MAP on 5 Oct, neither deal moved, and recruiters moved them on by hand a
-- day or two later. All three live Follow Up maps are configured this way.
--
-- Ghulam's decision (9 Oct): leave the card where it is. A reply during Follow
-- Up stops the emails and the reply badge on the card is what tells the
-- recruiter — the deal is not dragged backwards.
--
-- So the stored value is cleared. Behaviour does not change, because it was
-- never applied; what changes is that the automation panel stops reporting a
-- move that does not happen, and the editor no longer defaults to it (see
-- ConfigureAutomationModal: replyStageReachable).
--
-- Scoped by stage ORDER, not by template, so it catches exactly the impossible
-- ones and leaves every reachable exit alone. Idempotent.

UPDATE automations a
SET config = a.config - 'exit_to_stage_id',
    updated_at = NOW()
WHERE a.trigger_stage_id IS NOT NULL
  AND a.config ? 'exit_to_stage_id'
  AND a.config->>'exit_to_stage_id' IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM pipeline_stages ts
    JOIN pipeline_stages es ON es.id = (a.config->>'exit_to_stage_id')::uuid
    WHERE ts.id = a.trigger_stage_id
      AND es.display_order <= ts.display_order
  );
