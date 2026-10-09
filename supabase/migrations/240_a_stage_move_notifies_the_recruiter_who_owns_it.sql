-- QA-51 Issue 2: 70% of the bell was other people's stage moves.
--
-- handle_deal_stage_notification() called notify_all_users() for every stage
-- change, so one card moving created a notification for every active admin,
-- super_admin and recruiter. 5,504 of the 7,829 notifications on the system
-- are 'deal_stage' — about 786 per person — which is why the super admins'
-- unread count reached 1,167 and stopped carrying any meaning.
--
-- Scoped to the recruiter who owns the deal, with the admins as the fallback
-- when nobody owns it. All 698 stage moves in the last 30 days have an owner,
-- so in practice this is 698 notifications where there were 698 x 12, and
-- nobody loses sight of a player they are actually working.
--
-- deal_won and deal_lost deliberately still go to everyone: they are genuine
-- org-wide news and there are 32 of them in total, so they are not the problem.
--
-- Ghulam's decision (9 Oct), after the 30-day auto-clear in migration 239
-- turned out to bound the growth without reducing the number — the volume is
-- current, not historical.

CREATE OR REPLACE FUNCTION notify_deal_owner_or_admins(
  p_deal_id  UUID,
  p_type     TEXT,
  p_title    TEXT,
  p_message  TEXT,
  p_href     TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner UUID;
BEGIN
  -- Same precedence the email alerts and the automation sender use:
  -- deal_owner_id first, then owner_id.
  SELECT COALESCE(d.deal_owner_id, d.owner_id)
  INTO v_owner
  FROM deals d
  WHERE d.id = p_deal_id;

  -- The owner must still be an active member of staff; an unowned deal, or one
  -- whose owner has left, falls back to the admins so it is not invisible.
  IF v_owner IS NOT NULL AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = v_owner AND p.is_active = true
  ) THEN
    INSERT INTO notifications (user_id, type, title, message, href, metadata)
    VALUES (v_owner, p_type, p_title, p_message, p_href, p_metadata);
  ELSE
    INSERT INTO notifications (user_id, type, title, message, href, metadata)
    SELECT p.id, p_type, p_title, p_message, p_href, p_metadata
    FROM profiles p
    WHERE p.is_active = true
      AND p.role IN ('admin', 'super_admin');
  END IF;
END;
$$;

COMMENT ON FUNCTION notify_deal_owner_or_admins(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) IS
  'Bell notification for one deal: the recruiter who owns it, or the admins '
  'when nobody active does.';

CREATE OR REPLACE FUNCTION public.handle_deal_stage_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_deal RECORD;
  v_stage RECORD;
  v_contact_name TEXT;
  v_type TEXT;
  v_title TEXT;
  v_message TEXT;
BEGIN
  SELECT d.title AS deal_title, c.first_name, c.last_name
  INTO v_deal
  FROM deals d
  LEFT JOIN contacts c ON c.id = d.contact_id
  WHERE d.id = NEW.deal_id;

  SELECT name, stage_type INTO v_stage
  FROM pipeline_stages
  WHERE id = NEW.to_stage_id;

  v_contact_name := COALESCE(v_deal.first_name, '') || ' ' || COALESCE(v_deal.last_name, '');
  v_message := TRIM(v_contact_name)
    || CASE WHEN v_deal.deal_title IS NOT NULL THEN ' — ' || v_deal.deal_title ELSE '' END;

  IF v_stage.stage_type = 'completed' THEN
    v_type := 'deal_won';
    v_title := 'Deal won!';
  ELSIF v_stage.stage_type = 'lost' THEN
    v_type := 'deal_lost';
    v_title := 'Deal lost';
  ELSE
    v_type := 'deal_stage';
    v_title := 'Deal moved to ' || v_stage.name;
  END IF;

  IF v_type = 'deal_stage' THEN
    -- The routine one. Goes to whoever is working this player.
    PERFORM notify_deal_owner_or_admins(
      NEW.deal_id, v_type, v_title, v_message, '/pipelines',
      jsonb_build_object('deal_id', NEW.deal_id, 'stage_id', NEW.to_stage_id)
    );
  ELSE
    -- Won and lost stay team-wide.
    PERFORM notify_all_users(
      v_type, v_title, v_message, '/pipelines',
      jsonb_build_object('deal_id', NEW.deal_id, 'stage_id', NEW.to_stage_id)
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Clear the backlog this created. Rows are kept and still listed in the bell;
-- they simply stop being counted as unread, because nobody was ever going to
-- read 786 stage moves each.
UPDATE notifications
SET is_read = true
WHERE type = 'deal_stage'
  AND is_read = false;
