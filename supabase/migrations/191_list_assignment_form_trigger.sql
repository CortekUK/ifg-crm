-- Point the existing List Assignment automations at the form submission they
-- were built to listen for.
--
-- NOT YET APPLIED — this changes when live automations fire, so it needs
-- sign-off:
--   node scripts/apply-migration.mjs supabase/migrations/191_list_assignment_form_trigger.sql
--
-- The save handler stamped trigger_type with
-- `type === 'deal_creation' ? 'form_submission' : 'enters_stage'`, so a List
-- Assignment (No Deal) automation — which has no pipeline and no stage by
-- design — was written as "deal enters stage" and had nothing to trigger on.
-- QA built one against the Gap Year form, switched it on, submitted the form,
-- and the contact was added to neither chosen list. The template could not
-- work at all.
--
-- The app no longer writes the wrong value (triggerTypeForAutomationType reads
-- it from the template), but automations saved before that keep theirs until
-- someone re-saves them.
--
-- Scope is deliberately just list_assignment. Payment Overdue
-- (invoice_overdue) and Pre-Departure (time_before_date) are mis-stamped the
-- same way, but correcting those changes when a live sequence fires rather
-- than making a dead one work, so they are left for a separate decision.
--
-- Idempotent: rows already on form_submission are not matched.
UPDATE automations
SET trigger_type = 'form_submission'
WHERE automation_type = 'list_assignment'
  AND COALESCE(trigger_type, '') <> 'form_submission';
