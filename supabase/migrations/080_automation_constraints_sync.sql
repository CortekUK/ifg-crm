-- Migration 080: Sync automation CHECK constraints with the canonical
-- constants in lib/constants/automations.ts (and the mirrored
-- supabase/functions/_shared/automation-constants.ts).
--
-- Before this migration:
--   * step_type allowed 5 values (051) but the TS union has 7
--     (missing: notify, create_portal_account)
--   * automation_type allowed 11 values (059) but the TS union has 12
--     (missing: list_assignment)
--   * trigger_type allowed only 3 values (016) but the TS union has 7
--     (missing: invoice_created, invoice_overdue, payment_received,
--      time_before_date)
--
-- These drifts mean the frontend/executor could reference step/trigger/
-- automation types that the database silently rejects. This migration
-- brings all three constraints in line with the single source of truth.

-- ----------------------------------------------------------------------
-- automation_steps.step_type
-- ----------------------------------------------------------------------
ALTER TABLE automation_steps DROP CONSTRAINT IF EXISTS automation_steps_step_type_check;
ALTER TABLE automation_steps ADD CONSTRAINT automation_steps_step_type_check
  CHECK (step_type IN (
    'send_email',
    'wait',
    'send_sms',
    'move_to_stage',
    'create_deal',
    'notify',
    'create_portal_account'
  ));

-- ----------------------------------------------------------------------
-- automations.automation_type
-- ----------------------------------------------------------------------
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
    'list_assignment',
    'custom'
  ));

-- ----------------------------------------------------------------------
-- automations.trigger_type
-- ----------------------------------------------------------------------
ALTER TABLE automations DROP CONSTRAINT IF EXISTS automations_trigger_type_check;
ALTER TABLE automations ADD CONSTRAINT automations_trigger_type_check
  CHECK (trigger_type IS NULL OR trigger_type IN (
    'form_submission',
    'enters_stage',
    'stage_change',
    'invoice_created',
    'invoice_overdue',
    'payment_received',
    'time_before_date'
  ));
