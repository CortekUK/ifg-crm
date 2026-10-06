-- Stamp deals.stage_entered_at whenever the stage actually changes.
--
-- NOT YET APPLIED — needs sign-off before running, because it backfills 613
-- existing rows. Apply with:
--   node scripts/apply-migration.mjs supabase/migrations/187_stamp_stage_entered_at.sql
--
-- Why: "Time in stage" on every deal card reads
-- `stage_entered_at || created_at`, and stage_entered_at was NULL on all 613
-- deals — only the inbound-reply handler ever set it. So every card has been
-- reporting days since the LEAD was created, not days in its current stage. A
-- deal created in July and moved to Follow Up yesterday showed ~90 days.
--
-- Nine separate code paths move a deal (kanban, list view, deal sheet, Stripe
-- webhook, reply handler, Calendly webhook, three automation outcomes, the
-- invoice-sent mover). Stamping it in each one would drift the moment a tenth
-- is added, so it belongs in the one trigger they all pass through.

CREATE OR REPLACE FUNCTION public.stamp_stage_entered_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.current_stage_id IS DISTINCT FROM OLD.current_stage_id THEN
    NEW.stage_entered_at := NOW();
  END IF;
  RETURN NEW;
END;
$function$;

-- BEFORE, so the new value is written as part of the same UPDATE rather than
-- costing a second one.
DROP TRIGGER IF EXISTS stamp_stage_entered_at_trigger ON deals;
CREATE TRIGGER stamp_stage_entered_at_trigger
  BEFORE UPDATE OF current_stage_id ON deals
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_stage_entered_at();

-- New deals start their clock at creation.
CREATE OR REPLACE FUNCTION public.stamp_stage_entered_at_on_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.stage_entered_at IS NULL THEN
    NEW.stage_entered_at := COALESCE(NEW.created_at, NOW());
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS stamp_stage_entered_at_insert_trigger ON deals;
CREATE TRIGGER stamp_stage_entered_at_insert_trigger
  BEFORE INSERT ON deals
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_stage_entered_at_on_insert();

-- Backfill. The honest value for a deal whose stage history was recorded is
-- its last stage change; deal_stage_history has been populated by
-- log_deal_stage_change all along. Anything with no history falls back to
-- created_at, which is what the UI was already showing.
UPDATE deals d
SET stage_entered_at = COALESCE(
  (SELECT MAX(h.changed_at) FROM deal_stage_history h
    WHERE h.deal_id = d.id AND h.to_stage_id = d.current_stage_id),
  d.created_at
)
WHERE d.stage_entered_at IS NULL;
