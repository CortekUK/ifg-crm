-- Dormant re-engagement cadence: every 3 weeks → every 2 weeks.
--
-- Migration 134 built the recurring tail and 135 set the user-facing fields,
-- both at 21 days. The requested cadence is a fortnight, so this moves the
-- live automations onto 14.
--
-- TWO places hold the interval and both have to move together:
--   1. automations.config.dormant_reminder_interval_days — what the builder UI
--      shows and what the compiler regenerates the tail from on next save.
--   2. the compiled `wait` step's delay_days — what the ENGINE actually
--      sleeps on. Changing only (1) would show "14" in the CRM while still
--      waiting 21 days, which is the kind of disagreement nobody notices for
--      a month.
--
-- Scope: every automation that currently has the dormant reminder enabled, so
-- this does not depend on the three hardcoded ids from 134/135 and will pick
-- up any enabled since.
--
-- Idempotent: re-running sets the same values.

-- 1. The user-facing config field.
UPDATE automations
SET config = COALESCE(config, '{}'::jsonb)
             || jsonb_build_object('dormant_reminder_interval_days', 14)
WHERE config->>'dormant_reminder_enabled' = 'true';

-- 2. The compiled wait step the engine loops on.
--
-- The tail is always (…, move_to_stage, send_email, wait) and the loop returns
-- to the send_email at config.recurring_loop_to_order, so the wait we want is
-- the step immediately after it. Targeting it by step_order (rather than "any
-- wait step") leaves the 2/5/10-day waits of the initial sequence alone.
UPDATE automation_steps s
SET delay_days = 14,
    delay_hours = 0
FROM automations a
WHERE s.automation_id = a.id
  AND a.config->>'dormant_reminder_enabled' = 'true'
  AND a.config->>'recurring_loop_to_order' IS NOT NULL
  AND s.step_type = 'wait'
  AND s.step_order = (a.config->>'recurring_loop_to_order')::int + 1;

-- 3. Already-waiting enrollments.
--
-- An enrollment parked mid-wait has next_step_at computed from the OLD 21 days
-- and would serve one more three-week gap before picking up the new cadence.
-- Pull those forward by a week so the change takes effect on the current
-- cycle, never pushing a send into the past (greatest(now, …) keeps anything
-- already due due).
UPDATE automation_enrollments e
SET next_step_at = GREATEST(now(), e.next_step_at - interval '7 days')
FROM automations a, automation_steps s
WHERE e.automation_id = a.id
  AND e.current_step_id = s.id
  AND e.status = 'active'
  AND e.next_step_at IS NOT NULL
  AND e.next_step_at > now()
  AND a.config->>'dormant_reminder_enabled' = 'true'
  AND a.config->>'recurring_loop_to_order' IS NOT NULL
  AND s.step_type = 'wait'
  AND s.step_order = (a.config->>'recurring_loop_to_order')::int + 1;
