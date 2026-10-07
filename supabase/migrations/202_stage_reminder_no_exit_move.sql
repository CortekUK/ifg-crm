-- QA-26: a Stage Reminder must nudge the player, not move them.
--
-- The template sends ONE reminder, so "the sequence finished with no reply" is
-- true the moment that email goes out. With a no-reply stage set, the deal was
-- moved immediately — the player had no chance to respond to the nudge they
-- had just been sent.
--
-- The move is also not forward-only on that branch, so a stalled deal in
-- Document Collecting was being sent backwards to Dormant. That branch stays
-- un-guarded deliberately for the other templates: Initial Contact's whole
-- no-reply path is a move to Dormant, which sits at display_order 0 and is
-- "backwards" by design. Guarding it globally would break the Dormant flow.
--
-- So the fix is scoped to the template that should never have offered the
-- option: the editor no longer shows it for stage_reminder, and this clears it
-- from the rows already saved with one.
--
-- Idempotent.

UPDATE automations
SET config = COALESCE(config, '{}'::jsonb) - 'no_reply_stage_id',
    no_reply_stage_id = NULL
WHERE automation_type = 'stage_reminder'
  AND (
    no_reply_stage_id IS NOT NULL
    OR COALESCE(config, '{}'::jsonb) ? 'no_reply_stage_id'
  );
