-- Migration 059: Expand automation_type CHECK constraint
-- The original constraint only allowed 4 types but the frontend has many more.

ALTER TABLE automations DROP CONSTRAINT IF EXISTS automations_automation_type_check;

ALTER TABLE automations ADD CONSTRAINT automations_automation_type_check
  CHECK (automation_type IN (
    'deal_creation',
    'initial_contact',
    'follow_up',
    'application_received',
    'interview_reminder',
    'post_interview',
    'deposit_invoice',
    'payment_overdue',
    'welcome_sequence',
    'pre_departure',
    'custom'
  ));
