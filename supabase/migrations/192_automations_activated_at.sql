-- Record when an automation was switched on, so switching one on stops
-- emailing everyone who was already standing in the stage.
--
-- NOT YET APPLIED — adds a column and backfills every automation, so it needs
-- sign-off:
--   node scripts/apply-migration.mjs supabase/migrations/192_automations_activated_at.sql
--
-- checkTriggers() enrols every deal currently sitting in the trigger stage and
-- had no way to tell "arrived while this was running" from "was already here".
-- So switching on an Initial Contact automation sent email 1 to the whole
-- stage within about five minutes — on a busy Initial Lead that is hundreds of
-- real players getting a cold "are you still interested?" at once, with no
-- warning to the person who flicked the switch and no way to recall it.
--
-- There was nothing on the row to compare against: automations has
-- created_at and updated_at, and updated_at moves on any edit, so it could not
-- stand in for "switched on at". Hence a dedicated column, written by
-- useToggleAutomation on every activation.
--
-- Backfill: existing automations get created_at. The ones already running have
-- long since enrolled their stage, so this changes nothing for them; it just
-- means a NULL never reads as "the beginning of time" and re-opens the hole.

ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

COMMENT ON COLUMN automations.activated_at IS
  'When the automation was last switched on. checkTriggers only enrols deals that entered the trigger stage after this, so activating never back-fills the stage.';

UPDATE automations
SET activated_at = created_at
WHERE activated_at IS NULL;
