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

-- 3. Already-waiting enrollments are deliberately LEFT ALONE.
--
-- An earlier draft pulled them forward a week so the new cadence applied to the
-- current cycle. Measured against live data that touched 344 real leads, and
-- for 12 of them the recomputed time was already in the past — so they would
-- have been emailed within minutes of this migration running.
--
-- That was the wrong trade. The Supabase edge functions that send these emails
-- (and that carry the working unsubscribe link) deploy separately from the web
-- app, so until they are redeployed the reminders still go out with the dead
-- link. Sending MORE of them, sooner, with no way to opt out is worse than the
-- problem this work set out to fix.
--
-- Leaving them be costs one extra cycle at the old interval: every lead already
-- waiting serves out its current 21-day gap, then picks up the fortnightly
-- cadence from its next reminder onwards. Nothing is sent early, and no send is
-- skipped.
