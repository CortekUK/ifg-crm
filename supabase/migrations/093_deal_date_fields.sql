-- Migration: add the three date fields the Pre-Departure (#11) automation
-- template depends on. Until now the template advertised them via
-- config.date_field but no schema column existed, so the trigger could
-- never fire. Adding them as nullable DATE columns on `deals`.
--
--   programme_start_date — when the player's programme begins
--   interview_date       — scheduled interview slot
--   arrival_date         — when the player physically arrives onsite
--
-- All three nullable so existing deals carry forward unchanged. Indexed for
-- the daily check-time-triggers cron, which scans deals by these columns.

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS programme_start_date DATE,
  ADD COLUMN IF NOT EXISTS interview_date       DATE,
  ADD COLUMN IF NOT EXISTS arrival_date         DATE;

CREATE INDEX IF NOT EXISTS idx_deals_programme_start_date
  ON deals(programme_start_date) WHERE programme_start_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_interview_date
  ON deals(interview_date) WHERE interview_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_arrival_date
  ON deals(arrival_date) WHERE arrival_date IS NOT NULL;
