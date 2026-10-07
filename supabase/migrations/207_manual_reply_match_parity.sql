-- QA-31 (Smart Match) bugs 1, 3 and 6 — the three that live in the database.
--
-- Bug 1 — Smart Match said "New contact" for players who already exist.
--   The modal loaded its candidate list with `.from('contacts').select('*')`
--   and no paging, so PostgREST returned its 1,000-row maximum. Ordered by
--   first name, that is every contact from "A…" to "Abdiel" — 1,000 of
--   179,468. Every other player on the system was invisible to the matcher,
--   so staff were shown "New contact" for real players and the similar-name
--   and similar-email tiers could never fire at all. Exact-email replies only
--   reached the right contact because of a last-second lookup on apply.
--
--   Scoring moves into SQL, where it can see all 179,468 rows and read the
--   trigram indexes that already exist on first_name, last_name and email.
--   The tiers are the ones the TypeScript used, so a suggestion that was
--   correct before is still correct — there are simply no longer 178,468
--   contacts hidden from it.
--
-- Bug 3 — a manual match never stamped the intent on the deal or moved it.
-- Bug 6 — after a manual match the reply pointed at one player's contact and
--   another player's deal.
--   Both are the same root cause. Stamping the intent, moving the card to
--   Contact Response and linking the reply to the right deal all happen in
--   the resend-inbound edge function, which only runs when a reply ARRIVES.
--   A human matching a reply later only ever wrote `contact_id`, so the deal
--   kept whatever intent it had, stayed in its old stage, and the reply kept
--   the deal_id of the player the original email was sent to.
--
--   Moving that work into a trigger on contact_id means every path that
--   matches a reply — Smart Match, the single Match dialog, or anything added
--   later — gets the same result, without each one restating the rules.
--
-- The trigger fires on UPDATE OF contact_id only, never on INSERT. Arrival is
-- already handled by resend-inbound and QA has verified that path end to end
-- (QA-28, QA-30); firing here as well would mean two code paths racing to do
-- the same writes on every inbound reply for no gain.

-- ---------------------------------------------------------------------------
-- 1. Suggesting a contact for an unmatched reply.
-- ---------------------------------------------------------------------------
-- Tiers, in the order the old TypeScript applied them:
--
--   100     exact email match
--   70–95   same email domain AND name similarity > 0.7
--   50–80   name similarity > 0.85, any domain
--
-- Candidates come from the trigram index on the name, not from a table scan:
-- `similarity() > threshold` is driven by the GIN indexes on first_name and
-- last_name. The domain test is then applied to those candidates rather than
-- being used to select them, which matters because "same domain" on gmail.com
-- would otherwise mean tens of thousands of rows.
CREATE OR REPLACE FUNCTION suggest_contact_for_reply(
  p_email TEXT,
  p_name  TEXT DEFAULT NULL
)
RETURNS TABLE (
  contact_id   UUID,
  confidence   INT,
  match_reason TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_email  TEXT := lower(trim(COALESCE(p_email, '')));
  v_name   TEXT := nullif(trim(COALESCE(p_name, '')), '');
  v_domain TEXT;
  v_first  TEXT;
  v_last   TEXT;
BEGIN
  IF v_email = '' THEN
    RETURN;
  END IF;

  -- Tier 1: exact email. Unique index on contacts.email, so at most one row.
  RETURN QUERY
  SELECT c.id, 100, 'Exact email match'::TEXT
  FROM contacts c
  WHERE lower(c.email) = v_email
  LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  -- Without a sender name there is nothing left to score on. Inbound replies
  -- carry from_name only when the sending mail client supplies a display
  -- name, so this is the common case, and answering "no suggestion" is the
  -- honest result rather than a guess.
  IF v_name IS NULL THEN
    RETURN;
  END IF;

  v_domain := split_part(v_email, '@', 2);

  -- "Hamza Shafique" has to be findable from a row holding first_name 'Hamza'
  -- and last_name 'Shafique'. Comparing the whole string against one column
  -- scores barely above the 0.3 trigram cutoff, so the per-word comparisons
  -- are what actually pull the right candidate in. All four predicates are
  -- served by the existing GIN indexes on first_name and last_name.
  v_first := split_part(v_name, ' ', 1);
  v_last  := NULLIF(regexp_replace(v_name, '^.*\s', ''), v_first);

  RETURN QUERY
  WITH candidates AS (
    SELECT
      c.id,
      c.email,
      similarity(
        trim(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')),
        v_name
      ) AS sim
    FROM contacts c
    WHERE c.first_name % v_name
       OR c.last_name  % v_name
       OR c.first_name % v_first
       OR (v_last IS NOT NULL AND c.last_name % v_last)
    ORDER BY sim DESC
    LIMIT 500
  )
  SELECT
    cd.id,
    CASE
      WHEN split_part(lower(cd.email), '@', 2) = v_domain
        THEN round((70 + cd.sim * 25)::NUMERIC)::INT
      ELSE round((50 + cd.sim * 30)::NUMERIC)::INT
    END,
    CASE
      WHEN split_part(lower(cd.email), '@', 2) = v_domain
        THEN 'Same domain + name match (' || round((cd.sim * 100)::NUMERIC)::INT || '%)'
      ELSE 'Name similarity (' || round((cd.sim * 100)::NUMERIC)::INT || '%)'
    END
  FROM candidates cd
  WHERE (split_part(lower(cd.email), '@', 2) = v_domain AND cd.sim > 0.7)
     OR cd.sim > 0.85
  -- A same-domain hit outranks a bare name hit at equal similarity, which is
  -- what the 70-base vs 50-base tiers encoded.
  ORDER BY
    (split_part(lower(cd.email), '@', 2) = v_domain) DESC,
    cd.sim DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION suggest_contact_for_reply(TEXT, TEXT) IS
  'QA-31 bug 1: suggests a contact for an unmatched reply across all contacts. '
  'Replaces a client-side scan that only ever saw the first 1,000 rows.';

GRANT EXECUTE ON FUNCTION suggest_contact_for_reply(TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. What a match must do to the deal, wherever the match came from.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION apply_reply_match_to_deal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_intent        TEXT;
  v_deal_id       UUID;
  v_pipeline_id   UUID;
  v_current_order INT;
  v_response_id   UUID;
  v_response_ord  INT;
BEGIN
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_intent := COALESCE(NEW.ai_intent, NEW.intent);

  -- The reply's pipeline comes from the email it answers, so it is the
  -- programme context even when the sender was not the player.
  v_pipeline_id := NEW.pipeline_id;
  IF v_pipeline_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Bug 6: the deal must belong to the contact the reply is now matched to.
  -- Re-resolved from (contact, pipeline) rather than trusted from the row,
  -- because the existing deal_id is the one for whoever the original email
  -- went out to.
  SELECT d.id
  INTO v_deal_id
  FROM deals d
  WHERE d.contact_id = NEW.contact_id
    AND d.pipeline_id = v_pipeline_id
    AND d.status = 'active'
  ORDER BY d.created_at DESC
  LIMIT 1;

  IF v_deal_id IS NULL THEN
    -- No deal for this player in this programme. Clear the stale pointer so
    -- the reply does not keep showing another player's deal; Smart Deal
    -- (QA-32) is the route that gives them one.
    IF NEW.deal_id IS NOT NULL THEN
      UPDATE email_replies SET deal_id = NULL WHERE id = NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.deal_id IS DISTINCT FROM v_deal_id THEN
    UPDATE email_replies SET deal_id = v_deal_id WHERE id = NEW.id;
  END IF;

  -- An unreadable reply tells us nothing about the player, so it must not
  -- stamp a badge or move a card. Same rule migration 206 applies to the
  -- sequence-stopping path: out-of-office autoreplies were moving deals.
  IF v_intent IS NULL THEN
    RETURN NEW;
  END IF;

  -- Bug 3a: the badge the board shows. Latest reply wins, as on arrival.
  UPDATE deals SET intent = v_intent WHERE id = v_deal_id;

  -- Bug 3b: move to Contact Response, but never backwards. Exact name first,
  -- then the lowest-ordered stage of type 'contact' — renaming a stage in the
  -- UI does not change its type, which is the edit that used to break this
  -- (migration 0c7521b / QA-30). Two pipelines carry more than one 'contact'
  -- stage, hence the explicit ordering rather than an arbitrary pick.
  SELECT s.id, s.display_order
  INTO v_response_id, v_response_ord
  FROM pipeline_stages s
  WHERE s.pipeline_id = v_pipeline_id
    AND (
      lower(trim(s.name)) = 'contact response'
      OR s.stage_type = 'contact'
    )
  ORDER BY (lower(trim(s.name)) = 'contact response') DESC, s.display_order ASC
  LIMIT 1;

  IF v_response_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.display_order
  INTO v_current_order
  FROM deals d
  JOIN pipeline_stages s ON s.id = d.current_stage_id
  WHERE d.id = v_deal_id;

  IF v_current_order IS NOT NULL AND v_current_order < v_response_ord THEN
    UPDATE deals
    SET current_stage_id  = v_response_id,
        stage_entered_at  = NOW()
    WHERE id = v_deal_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION apply_reply_match_to_deal() IS
  'QA-31 bugs 3 and 6: gives a hand-matched reply the same effect on the deal '
  'as an auto-matched one — intent stamped, card moved to Contact Response, '
  'reply re-linked to the matched contact''s deal.';

DROP TRIGGER IF EXISTS email_reply_match_applies_to_deal ON email_replies;
DROP TRIGGER IF EXISTS email_reply_match_then_updates_deal ON email_replies;

-- UPDATE OF contact_id only: arrival is resend-inbound's job and is already
-- verified. The WHEN clause keeps it to real re-matches, so marking a reply
-- read or spam does not re-run any of this, and the deal_id write this
-- function makes cannot re-enter it.
--
-- The name is load-bearing. Postgres fires same-event triggers in alphabetical
-- order, and "…match_then_updates_deal" sorts after the existing
-- "email_reply_match_stops_enrollments". That is the order arrival uses: the
-- stop trigger runs on the INSERT, and resend-inbound stamps the intent and
-- moves the card afterwards. Where an automation's own exit stage differs from
-- Contact Response, the two paths disagree, and whichever writes last wins —
-- so a hand-matched reply has to write in the same sequence as an auto-matched
-- one or the card ends up somewhere arrival would never have put it.
CREATE TRIGGER email_reply_match_then_updates_deal
AFTER UPDATE OF contact_id ON email_replies
FOR EACH ROW
WHEN (NEW.contact_id IS NOT NULL AND OLD.contact_id IS DISTINCT FROM NEW.contact_id)
EXECUTE FUNCTION apply_reply_match_to_deal();
