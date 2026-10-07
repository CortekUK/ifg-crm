-- Take the "test" staff account out of the deal-owner rotation.
--
-- NOT YET APPLIED — this deactivates a live user account, so it needs
-- sign-off:
--   node scripts/apply-migration.mjs supabase/migrations/193_deactivate_test_staff_account.sql
--
-- The round robin assigns new leads across every ACTIVE recruiter, admin and
-- super_admin, and test@macclesfieldfc.com is one of them. QA submitted three
-- players through the University form and the rotation handed one to "test",
-- so that player's automated emails went out from
-- "test <test@macclesfieldfc.com>" — to a real inbox, under a name that is
-- obviously not a person. It has no Calendly link either, so any booking email
-- it sent would have carried a dead button.
--
-- Deactivating is the whole fix: assignRoundRobinOwner already filters on
-- is_active, both when resolving "all staff" and when pruning a hand-picked
-- rotation, so no code change is needed and nothing has to remember to edit
-- each automation. Deals it already owns are deliberately left alone rather
-- than reassigned — picking a new owner for a real player is a decision for a
-- person, and they will show up in the usual "unassigned or inactive owner"
-- review.
--
-- Deliberately NOT added to EXCLUDED_DEAL_OWNER_EMAILS in code: that list is
-- for the permanent system administrator, and a test account does not belong
-- hardcoded in the application.
--
-- Idempotent: an already-inactive row is not matched.
UPDATE profiles
SET is_active = false,
    updated_at = NOW()
WHERE lower(email) = 'test@macclesfieldfc.com'
  AND is_active = true;
