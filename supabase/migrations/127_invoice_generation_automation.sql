-- Migration: invoice_generation automation type + create_invoice step type.
--
-- Closes the gap where deals would land in the pipeline with a deal_value
-- but no machinery to actually issue an invoice. The invoice_generation
-- automation triggers on `enters_stage` (e.g. deal lands in "Deposit") and
-- emits a single create_invoice step that the process-automations edge
-- function executes — inserting an invoice row whose amount is computed
-- from the deal's deal_value (or a configurable percentage / custom
-- override).
--
-- The invoice is inserted with status='sent' so the existing on_invoice_sent
-- trigger (migration 109) chains the deal into the deposit_invoice
-- automation for follow-up emails. Separation of concerns: this automation
-- creates the invoice, deposit_invoice handles the email cadence.

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
    'custom'
  ));

ALTER TABLE automation_steps
  DROP CONSTRAINT IF EXISTS automation_steps_step_type_check;

ALTER TABLE automation_steps
  ADD CONSTRAINT automation_steps_step_type_check
  CHECK (step_type IN (
    'send_email',
    'wait',
    'wait_until_before_date',
    'wait_until_meeting_ends',
    'send_sms',
    'move_to_stage',
    'create_deal',
    'create_invoice',
    'notify',
    'create_portal_account'
  ));
