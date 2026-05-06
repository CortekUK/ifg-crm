-- Add 'stage_reminder' to the allowed automation_type values.
--
-- A stage_reminder is a generic "deal has been parked in this stage for
-- N days, nudge the contact" automation. It triggers on enters_stage,
-- waits a configurable number of days (default 7), and sends one email.
-- Used for stages like Document Collecting where the recruiter wants a
-- one-week reminder if the contact hasn't moved on yet.
--
-- Postgres can't ALTER a CHECK constraint in place, so we drop and recreate.

ALTER TABLE automations
  DROP CONSTRAINT IF EXISTS automations_automation_type_check;

ALTER TABLE automations
  ADD CONSTRAINT automations_automation_type_check
  CHECK (automation_type IN (
    'deal_creation',
    'initial_contact',
    'follow_up',
    'application_received',
    'interview_reminder',
    'meeting_scheduler',
    'post_interview',
    'invoice_generation',
    'deposit_invoice',
    'payment_overdue',
    'welcome_sequence',
    'pre_departure',
    'list_assignment',
    'stage_reminder',
    'custom'
  ));
