-- QA-34 observation: two test automations are still live on real leads.
--
-- QA found these running for every new UK Gap lead:
--
--   "Test Automation UK Gap Year"              11 real leads so far
--   "UK Gap Year Deal Automation for testing"  13 real leads so far
--
-- Both are form_submission automations on UK GAP 2027 whose only step is
-- "create deal". The real one, "UK Gap 2027 Deal Creation", already covers that
-- pipeline, so these are duplicates. They have not produced a second deal only
-- because the processor refuses to create one where the contact already has a
-- deal in the pipeline — the dedup guard is the sole reason this has been
-- harmless.
--
-- That is a thin margin to leave in place on live intake: anything that widens
-- the dedup rule, or a lead arriving down two paths at once, turns them into
-- duplicate deals on real players. QA asked for them to be switched off.
--
-- Deactivated, not deleted, so the configuration survives if it is wanted for a
-- future test. Matched by exact name so nothing else can be caught.
--
-- Idempotent.

UPDATE automations
SET is_active = false,
    updated_at = NOW()
WHERE is_active
  AND name IN ('Test Automation UK Gap Year', 'UK Gap Year Deal Automation for testing');
