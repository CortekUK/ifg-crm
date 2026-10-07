-- Manual card order on the pipeline board.
--
-- Dragging a card next to another card in the same stage did nothing: the drag
-- handler only ever acted on a stage change, and `deals` had no column to
-- store a position in. The card snapped back to wherever the column's sort put
-- it, which read as the drag being broken rather than as a feature that did
-- not exist.
--
-- `board_position` is a double, not an integer, so dropping a card between two
-- others is a single-row write of the midpoint rather than a renumber of the
-- whole stage. University's Dormant stage holds 328 cards; rewriting all of
-- them on every drop would be a lot of churn for one card moving.
--
-- Positions are scoped to a stage, not a pipeline. A card that moves stage is
-- given a fresh position at the top of its destination, which is where someone
-- who just moved it expects to find it.

ALTER TABLE deals ADD COLUMN IF NOT EXISTS board_position double precision;

-- Backfill in the order the board shows today (newest first), so switching the
-- default sort to manual is invisible on day one: same cards, same order.
-- Gaps of 1000 leave room to insert between neighbours many times before any
-- midpoint gets close to the limits of a double.
WITH ordered AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY current_stage_id
           ORDER BY created_at DESC, id
         ) * 1000.0 AS pos
  FROM deals
)
UPDATE deals d
SET board_position = o.pos
FROM ordered o
WHERE o.id = d.id
  AND d.board_position IS DISTINCT FROM o.pos;

-- A new deal belongs at the TOP of its stage — it is the freshest lead, and
-- the board has always shown newest first. Done in a trigger rather than the
-- application because deals are created from four separate places (the website
-- form path, the ActiveCampaign webhook, the WordPress webhook and the
-- form-webhook edge function); one of them forgetting would leave a NULL that
-- sorts unpredictably.
CREATE OR REPLACE FUNCTION set_initial_board_position()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.board_position IS NULL THEN
    SELECT COALESCE(MIN(board_position), 1000.0) - 1000.0
      INTO NEW.board_position
      FROM deals
     WHERE current_stage_id = NEW.current_stage_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_set_initial_board_position ON deals;
CREATE TRIGGER deals_set_initial_board_position
  BEFORE INSERT ON deals
  FOR EACH ROW
  EXECUTE FUNCTION set_initial_board_position();

-- The board reads one stage at a time, ordered by position.
CREATE INDEX IF NOT EXISTS idx_deals_stage_board_position
  ON deals (current_stage_id, board_position);
