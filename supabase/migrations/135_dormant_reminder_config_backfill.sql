-- Migration 135: backfill the user-facing dormant_reminder_* fields onto the
-- three INITIAL CONTACT MAP automations.
--
-- Migration 134 appended the recurring tail + set the derived recurring_*
-- fields directly. This adds the *controllable* fields the builder UI reads
-- and writes (dormant_reminder_enabled / _template_id / _interval_days) so
-- that opening one of these automations in the editor shows the Dormant
-- Reminder section pre-filled — and re-saving regenerates the exact same tail
-- (the compiler + deriveRecurringMeta drive off these fields) instead of
-- silently dropping it.
--
-- Idempotent: jsonb merge, safe to re-run.

UPDATE automations
SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object(
      'dormant_reminder_enabled', true,
      'dormant_reminder_template_id', 'a1b2c3d4-0000-4000-8000-000000000134',
      'dormant_reminder_interval_days', 21
    )
WHERE id IN (
  '77778723-5dc8-40c1-825a-b76f3808004c',  -- UK Gap - INITIAL CONTACT MAP
  '590194b9-c16e-4e51-813b-e0e3f6d366ed',  -- Summer Residency INITIAL CONTACT MAP
  'af84819a-4cfe-448b-902d-9c65798728b9'   -- University of Lancashire - INITIAL CONTACT MAP
);
