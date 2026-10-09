-- Four reply findings that all come down to one question: does this reply
-- actually tell us something about the player?
--
-- QA-28 Bug 3 — an out-of-office auto-reply was treated as a genuine reply.
--   "Automatic reply: I'm on leave" is classified neutral, neutral counts as a
--   readable intent, so it stopped the player's sequence for good and moved
--   their card to Contact Response. A player who happens to be on holiday when
--   an email lands stops being chased, and the board says they responded.
--
-- QA-29 Bug 4 — 'unknown' was treated as a genuine reply.
--   The classifier returns 'unknown' for "cannot determine intent". It was
--   written to the deal's badge, it stopped the sequence as a real reply, and
--   it moved the card. The ticket says a reply whose intent cannot be decided
--   must not update or move the deal.
--
-- QA-29 Bug 3 — correcting a label left the board showing the old one.
--   A recruiter can change a reply's label in Replies, but the deal's badge is
--   only written when a reply arrives or is matched by hand, so the card kept
--   the wrong label for good.
--
-- QA-31 new issue 1 — matching an OLDER reply overwrote the latest intent.
--   Hand-matching a 7 Oct reply labelled 'unknown' replaced a 9 Oct 'neutral'
--   badge, and unmatching it left 'unknown' behind with no reply to justify it.
--
-- The shape of the fix: one definition of "carries an intent", and one
-- function that derives a deal's badge from its replies rather than letting
-- whichever write happened last win. Every path — arrival, hand-match,
-- unmatch, label correction — then agrees by construction.

-- ---------------------------------------------------------------------------
-- 1. Auto-replies are marked as they arrive.
-- ---------------------------------------------------------------------------
-- Set by the resend-inbound function from the auto-submitted / x-autoreply /
-- precedence headers and the "Automatic reply" / "Out of office" subject
-- forms. Defaulting to false leaves every existing row behaving as it does
-- today.
ALTER TABLE email_replies
  ADD COLUMN IF NOT EXISTS is_auto_reply BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN email_replies.is_auto_reply IS
  'True for an out-of-office / vacation autoresponder. Such a reply is stored '
  'and shown, but it never stamps a deal, moves a card or stops a sequence.';

-- ---------------------------------------------------------------------------
-- 2. One definition, used everywhere.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reply_carries_intent(p_intent TEXT, p_is_auto BOOLEAN)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_intent IS NOT NULL
     AND p_intent <> 'unknown'
     AND NOT COALESCE(p_is_auto, false);
$$;

COMMENT ON FUNCTION reply_carries_intent(TEXT, BOOLEAN) IS
  'Does this reply say something about the player? False for an unreadable '
  'reply, for ''unknown'', and for an autoresponder.';

-- ---------------------------------------------------------------------------
-- 3. A deal's badge is derived from its replies, never just overwritten.
-- ---------------------------------------------------------------------------
-- The newest reply on the deal that carries an intent wins, and if none does
-- the badge is cleared. That is what "the card always shows the latest reply's
-- intent" means, and it makes the order of writes stop mattering: an old reply
-- matched today cannot outrank a newer one, and removing the reply that set a
-- badge takes the badge with it.
CREATE OR REPLACE FUNCTION recompute_deal_intent(p_deal_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_intent TEXT;
BEGIN
  IF p_deal_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(er.ai_intent, er.intent)
  INTO v_intent
  FROM email_replies er
  WHERE er.deal_id = p_deal_id
    AND reply_carries_intent(COALESCE(er.ai_intent, er.intent), er.is_auto_reply)
  ORDER BY er.received_at DESC NULLS LAST, er.created_at DESC
  LIMIT 1;

  UPDATE deals
  SET intent = v_intent
  WHERE id = p_deal_id
    AND intent IS DISTINCT FROM v_intent;
END;
$$;

COMMENT ON FUNCTION recompute_deal_intent(UUID) IS
  'Sets deals.intent from the newest reply on the deal that carries an intent, '
  'or NULL when none does.';

-- ---------------------------------------------------------------------------
-- 4. Stopping the sequence.
-- ---------------------------------------------------------------------------
-- Changes from migration 206:
--   * an autoresponder stops nothing at all — it is not the player answering
--   * 'unknown' is no longer "has intent", so it keeps the sequence-stopped
--     wording that contains no "repl" and therefore does NOT move the deal.
--     Somebody did type something, so the chase still stops and a human looks.
CREATE OR REPLACE FUNCTION stop_enrollments_on_reply_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_enrollment_id UUID;
  target_deal_id UUID;
  stop_reason TEXT;
  has_intent BOOLEAN;
BEGIN
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.contact_id IS NOT DISTINCT FROM NEW.contact_id THEN
    RETURN NEW;
  END IF;

  -- QA-28 Bug 3: a holiday autoresponder must not end the conversation.
  IF COALESCE(NEW.is_auto_reply, false) THEN
    RETURN NEW;
  END IF;

  has_intent := reply_carries_intent(COALESCE(NEW.ai_intent, NEW.intent), NEW.is_auto_reply);

  IF NEW.email_send_id IS NOT NULL THEN
    SELECT al.enrollment_id, al.deal_id
    INTO target_enrollment_id, target_deal_id
    FROM email_sends es
    JOIN automation_logs al ON es.automation_log_id = al.id
    JOIN automation_enrollments ae ON ae.id = al.enrollment_id
    JOIN automations a ON ae.automation_id = a.id
    WHERE es.id = NEW.email_send_id
      AND ae.status = 'active'
      AND COALESCE(a.exit_on_reply, (a.config->>'exit_on_reply')::boolean, true) = true
      -- enrolled_at, NOT created_at: automation_enrollments has no
      -- created_at column at all (see migration 209, which fixed exactly this
      -- after migration 206 shipped the wrong name and the function threw
      -- 42703 on every inbound reply).
      AND COALESCE(ae.enrolled_at, '-infinity'::timestamptz) <= COALESCE(NEW.received_at, NOW())
    LIMIT 1;

    IF target_enrollment_id IS NOT NULL THEN
      stop_reason := CASE
        WHEN has_intent THEN 'Contact replied to email'
        ELSE 'Contact responded, intent unreadable — sequence stopped, deal not moved'
      END;
    END IF;
  ELSE
    SELECT al.enrollment_id, al.deal_id
    INTO target_enrollment_id, target_deal_id
    FROM email_sends es
    JOIN automation_logs al ON es.automation_log_id = al.id
    JOIN automation_enrollments ae ON ae.id = al.enrollment_id
    JOIN automations a ON ae.automation_id = a.id
    WHERE es.recipient_contact_id = NEW.contact_id
      AND ae.status = 'active'
      AND COALESCE(a.exit_on_reply, (a.config->>'exit_on_reply')::boolean, true) = true
      AND es.sent_at > now() - interval '30 days'
      -- enrolled_at, NOT created_at: automation_enrollments has no
      -- created_at column at all (see migration 209, which fixed exactly this
      -- after migration 206 shipped the wrong name and the function threw
      -- 42703 on every inbound reply).
      AND COALESCE(ae.enrolled_at, '-infinity'::timestamptz) <= COALESCE(NEW.received_at, NOW())
    ORDER BY es.sent_at DESC
    LIMIT 1;

    IF target_enrollment_id IS NOT NULL THEN
      stop_reason := CASE
        WHEN has_intent THEN 'Replied (matched by most recent send — thread headers missing)'
        ELSE 'Responded, intent unreadable (matched by most recent send) — deal not moved'
      END;
    END IF;
  END IF;

  IF target_enrollment_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE automation_enrollments
  SET status         = 'stopped',
      stopped_reason = stop_reason,
      next_step_at   = NULL
  WHERE id = target_enrollment_id;

  INSERT INTO automation_logs (enrollment_id, deal_id, status, sent_at, log_type, error_message)
  VALUES (target_enrollment_id, target_deal_id, 'skipped', now(), 'enrollment_stopped', stop_reason);

  UPDATE email_replies
  SET processed = true
  WHERE id = NEW.id
    AND processed = false;

  RETURN NEW;
END;
$$;

-- The other path that stops a sequence on reply (read by check-replies) needs
-- the same exclusion, or an autoresponder still ends the chase from there.
CREATE OR REPLACE VIEW pending_reply_stops AS
 SELECT er.id AS reply_id,
    er.contact_id,
    ae.id AS enrollment_id,
    ae.automation_id,
    a.name AS automation_name,
    (c.first_name || ' '::text) || c.last_name AS contact_name
   FROM email_replies er
     JOIN email_sends es ON er.email_send_id = es.id
     JOIN automation_logs al ON es.automation_log_id = al.id
     JOIN automation_steps ast ON al.step_id = ast.id
     JOIN automations a ON ast.automation_id = a.id
     JOIN automation_enrollments ae ON ae.automation_id = a.id AND ae.deal_id = al.deal_id
     JOIN deals d ON ae.deal_id = d.id
     JOIN contacts c ON d.contact_id = c.id
  WHERE ae.status = 'active'::text
    AND er.processed = false
    AND COALESCE(er.is_auto_reply, false) = false
    AND (a.exit_on_reply = true OR ((a.config ->> 'exit_on_reply'::text)::boolean) = true)
    AND COALESCE(ae.enrolled_at, '-infinity'::timestamptz)
          <= COALESCE(er.received_at, now());

-- ---------------------------------------------------------------------------
-- 5. Hand-matching a reply.
-- ---------------------------------------------------------------------------
-- Same as migration 207 except for the badge: it is now derived rather than
-- assigned, so matching an older reply cannot overrule a newer one. The MOVE
-- still keys off this reply, because moving the card is a response to the
-- reply the human just matched.
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
  v_pipeline_id := NEW.pipeline_id;
  IF v_pipeline_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT d.id
  INTO v_deal_id
  FROM deals d
  WHERE d.contact_id = NEW.contact_id
    AND d.pipeline_id = v_pipeline_id
    AND d.status = 'active'
  ORDER BY d.created_at DESC
  LIMIT 1;

  IF v_deal_id IS NULL THEN
    IF NEW.deal_id IS NOT NULL THEN
      UPDATE email_replies SET deal_id = NULL WHERE id = NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.deal_id IS DISTINCT FROM v_deal_id THEN
    UPDATE email_replies SET deal_id = v_deal_id WHERE id = NEW.id;
  END IF;

  -- Derive the badge from every reply now on the deal, including the one just
  -- linked above. Handles QA-31 new issue 1 in both directions: an older
  -- 'unknown' neither wins nor erases the newer label.
  PERFORM recompute_deal_intent(v_deal_id);

  IF NOT reply_carries_intent(v_intent, NEW.is_auto_reply) THEN
    RETURN NEW;
  END IF;

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

-- ---------------------------------------------------------------------------
-- 6. Unmatching a reply, and correcting its label.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_deal_intent_from_replies()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Both the deal the reply is leaving and the one it is on now. On an unmatch
  -- OLD.deal_id is the deal losing the reply; on a label correction they are
  -- the same and the second call is a no-op.
  PERFORM recompute_deal_intent(OLD.deal_id);
  IF NEW.deal_id IS DISTINCT FROM OLD.deal_id THEN
    PERFORM recompute_deal_intent(NEW.deal_id);
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION refresh_deal_intent_from_replies() IS
  'QA-29 Bug 3 / QA-31 new issue 1: a corrected label or an unmatched reply '
  'must be reflected on the board, not just on the reply.';

-- Sorts after "email_reply_match_then_updates_deal", so on a re-match the
-- derive-the-badge work runs last. Same-event triggers fire alphabetically.
DROP TRIGGER IF EXISTS email_reply_zz_refreshes_deal_intent ON email_replies;
CREATE TRIGGER email_reply_zz_refreshes_deal_intent
AFTER UPDATE OF ai_intent, intent, contact_id, deal_id ON email_replies
FOR EACH ROW
WHEN (
  COALESCE(NEW.ai_intent, NEW.intent) IS DISTINCT FROM COALESCE(OLD.ai_intent, OLD.intent)
  OR NEW.contact_id IS DISTINCT FROM OLD.contact_id
  OR NEW.deal_id IS DISTINCT FROM OLD.deal_id
)
EXECUTE FUNCTION refresh_deal_intent_from_replies();

-- ---------------------------------------------------------------------------
-- 7. Backfill: bring existing badges in line with the rule above.
-- ---------------------------------------------------------------------------
-- Two deals carried an 'unknown' badge that no reply justified — one of them
-- ("GAMA GHULAM") has no replies at all, and QA-31's leftover on Hamza QA 45
-- showed 'unknown' over a newer 'neutral' reply. Dry-run before applying: all
-- 13 genuine badges (positive/negative/neutral/question) derive to exactly
-- what they already show, so this only clears the unsupported ones.
-- Every deal that has a reply, not just ones that already show a badge: until
-- now the badge was only written at the moment a reply arrived, so a player
-- whose reply was classified later (or re-classified by the QA-29 backfill)
-- had a labelled reply and a blank card. Five real players were in that state,
-- including the "What is the cost for your program?" and "The cost isn't in
-- our budget" replies QA named — the exact "recruiters miss interested players
-- and price questions" impact.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT d.id
    FROM deals d
    WHERE d.intent IS NOT NULL
       OR EXISTS (SELECT 1 FROM email_replies er WHERE er.deal_id = d.id)
  LOOP
    PERFORM recompute_deal_intent(r.id);
  END LOOP;
END $$;
