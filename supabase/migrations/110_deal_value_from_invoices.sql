-- Migration: deals.deal_value is now the sum of all 'sent' + 'paid' invoices
-- on that deal.
--
-- Drafts and cancelled invoices don't count (a draft isn't real money owed
-- yet; a cancelled invoice was never collected). The recalculation runs on
-- every invoice INSERT / UPDATE / DELETE that could affect the sum, and
-- also on the OLD.deal_id when a deal_id changes (so moving an invoice
-- between deals updates both totals).
--
-- One-time backfill at the bottom syncs every existing deal's value to
-- match its current invoice rows so the system starts in a consistent
-- state.

CREATE OR REPLACE FUNCTION recalc_deal_value(p_deal_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_deal_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE deals
  SET deal_value = COALESCE((
    SELECT SUM(amount)
    FROM invoices
    WHERE deal_id = p_deal_id
      AND status IN ('sent', 'paid')
  ), 0)
  WHERE id = p_deal_id;
END;
$$;

CREATE OR REPLACE FUNCTION on_invoice_change_recalc_deal_value()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM recalc_deal_value(NEW.deal_id);
  ELSIF TG_OP = 'UPDATE' THEN
    -- If the deal_id, amount, or status changed, recalc affected deals.
    -- If deal_id moved, both source and destination need updating.
    PERFORM recalc_deal_value(NEW.deal_id);
    IF NEW.deal_id IS DISTINCT FROM OLD.deal_id THEN
      PERFORM recalc_deal_value(OLD.deal_id);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM recalc_deal_value(OLD.deal_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_invoice_change_recalc_deal_value ON invoices;
CREATE TRIGGER on_invoice_change_recalc_deal_value
AFTER INSERT OR UPDATE OF amount, status, deal_id OR DELETE ON invoices
FOR EACH ROW
EXECUTE FUNCTION on_invoice_change_recalc_deal_value();

-- One-time backfill: pull existing data into sync.
UPDATE deals d
SET deal_value = COALESCE((
  SELECT SUM(i.amount)
  FROM invoices i
  WHERE i.deal_id = d.id
    AND i.status IN ('sent', 'paid')
), 0)
WHERE EXISTS (SELECT 1 FROM invoices i WHERE i.deal_id = d.id);
