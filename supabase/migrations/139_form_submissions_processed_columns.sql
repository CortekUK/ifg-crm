-- Migration 139: add the processed_at / processing_time_ms columns the form
-- handlers have always written but the live DB never had (schema drift).
--
-- Migration 007's CREATE TABLE declared both columns, but at least one
-- production database is missing them (same drift class migration 094 fixed
-- for form_source). The shared form processor and the form-webhook edge
-- function enrich each submission row in a single UPDATE that sets
-- processed_at, processing_time_ms AND deal_id/automation_id/assigned_user_id.
-- Because processed_at didn't exist, that UPDATE failed for every submission —
-- silently, since the call isn't error-checked — so the Deal / Automation /
-- Assigned-to columns were never populated and the detail view's Processed /
-- Processing rows were always blank.
--
-- Idempotent: IF NOT EXISTS on both adds.

ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;

ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
