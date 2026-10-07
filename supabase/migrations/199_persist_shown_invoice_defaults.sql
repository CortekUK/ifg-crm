-- Write the settings the automation editor has been *showing* but never saving.
--
-- QA-23 Bug 1. Every control in the editor renders a default when its setting
-- has no value — "Stop on payment" draws itself ticked, Invoice Type reads
-- "Deposit" — but none of those defaults were written to the saved config
-- unless somebody clicked the control. The engine treats a missing setting as
-- off, so the screen and the database disagreed with no sign of it anywhere.
--
-- The editor is fixed from now on (handleSave resolves every shown default),
-- but automations saved before that still carry the gap:
--
--   Summer Residency Invoice Creation   stop_on_payment MISSING   1 live enrolment
--   UK-GAP invoice generation           stop_on_payment MISSING   8 live enrolments
--
-- With it missing, `stop on payment` is off: a player who has paid their
-- deposit keeps receiving both overdue-reminder emails. That is nine real
-- people on the two live pipelines, being chased for money they have already
-- sent.
--
-- invoice_type is set for the same reason — the editor shows "Deposit", the
-- column it maps to is `invoices.type`, and leaving it null means the invoice
-- is filed as neither a deposit nor a full payment.
--
-- Scoped to automations that actually raise invoices, and only where the value
-- is absent — an automation someone deliberately switched OFF keeps its false.
--
-- Idempotent: re-running changes nothing once the keys exist.

UPDATE automations a
SET config = COALESCE(a.config, '{}'::jsonb)
             || jsonb_build_object('stop_on_payment', true)
WHERE EXISTS (
    SELECT 1 FROM automation_steps s
     WHERE s.automation_id = a.id AND s.step_type = 'create_invoice'
  )
  AND NOT (COALESCE(a.config, '{}'::jsonb) ? 'stop_on_payment');

UPDATE automations a
SET config = COALESCE(a.config, '{}'::jsonb)
             || jsonb_build_object('invoice_type', 'deposit')
WHERE EXISTS (
    SELECT 1 FROM automation_steps s
     WHERE s.automation_id = a.id AND s.step_type = 'create_invoice'
  )
  AND NOT (COALESCE(a.config, '{}'::jsonb) ? 'invoice_type');
