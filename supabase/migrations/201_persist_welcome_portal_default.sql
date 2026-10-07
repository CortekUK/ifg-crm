-- QA-25 Bug 4: "Create portal account" was shown ticked and never saved.
--
-- Same root cause as QA-23 Bug 1 — the editor rendered a default it did not
-- write, and the engine reads a missing setting as off. The editor is fixed
-- (handleSave now persists every shown default); this repairs the rows saved
-- before that.
--
-- Two of these are ACTIVE and the effect is visible:
--
--   Deposit Paid                            active, setting missing
--   Summer Residency Arrival Player Portal  active, setting missing
--
-- A player moved to those stages by hand got the welcome email and no portal
-- account at all, even though the box looked ticked. Players who PAID still
-- got one, because the payment path creates it — which is why this went
-- unnoticed. The second automation is called "Arrival Player Portal"; creating
-- the portal account is the entire point of it.
--
-- Only fills the gap where the key is absent. An automation somebody
-- deliberately switched OFF keeps its false.
--
-- Idempotent.

UPDATE automations
SET config = COALESCE(config, '{}'::jsonb)
             || jsonb_build_object('create_portal_account', true)
WHERE automation_type = 'welcome_sequence'
  AND NOT (COALESCE(config, '{}'::jsonb) ? 'create_portal_account');
