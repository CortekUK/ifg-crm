-- Campaign audiences were resolved in JavaScript by selecting every join row
-- and de-duplicating client-side. PostgREST caps an unbounded select at 1000
-- rows, and contact_lists alone holds 303,710 — so:
--
--   * the "Total Recipients" figure in the composer maxed out at 1,000
--   * app/api/campaigns/[id]/send counted at most 1,000
--   * process-campaigns expanded at most 1,000 people into campaign_recipients
--
-- A campaign aimed at the 105k "ALL CONTACTS EVERYONE" list therefore reported
-- 1,000 recipients and genuinely sent to 1,000 people, with no error anywhere.
-- Both functions below do the union, the de-duplication and the subscription
-- filter in SQL, so the numbers are real and the expansion is a single
-- statement instead of ~1,000 round trips.

-- Contacts reachable from any combination of lists, tags and pipeline stages.
-- Mirrors the filtering the sender applies, so the composer's count and the
-- number actually emailed agree.
CREATE OR REPLACE FUNCTION public.campaign_audience_contacts(
  p_list_ids  UUID[] DEFAULT '{}',
  p_tag_ids   UUID[] DEFAULT '{}',
  p_stage_ids UUID[] DEFAULT '{}',
  p_type      TEXT   DEFAULT 'email'
)
RETURNS TABLE (contact_id UUID)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT c.id
  FROM contacts c
  WHERE c.subscription_status = 'subscribed'
    AND (p_type <> 'sms' OR c.sms_subscribed IS TRUE)
    AND (
      EXISTS (
        SELECT 1 FROM contact_lists cl
        WHERE cl.contact_id = c.id
          AND cl.list_id = ANY (COALESCE(p_list_ids, '{}'))
      )
      OR EXISTS (
        SELECT 1 FROM contact_tags ct
        WHERE ct.contact_id = c.id
          AND ct.tag_id = ANY (COALESCE(p_tag_ids, '{}'))
      )
      OR EXISTS (
        SELECT 1 FROM deals d
        WHERE d.contact_id = c.id
          AND d.current_stage_id = ANY (COALESCE(p_stage_ids, '{}'))
          AND d.won_at IS NULL
          AND d.lost_at IS NULL
      )
    );
$$;

-- Count wrapper for the composer. Returns 0 rather than erroring when no
-- source is selected, so the UI can call it unconditionally.
CREATE OR REPLACE FUNCTION public.campaign_audience_count(
  p_list_ids  UUID[] DEFAULT '{}',
  p_tag_ids   UUID[] DEFAULT '{}',
  p_stage_ids UUID[] DEFAULT '{}',
  p_type      TEXT   DEFAULT 'email'
)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COUNT(*)::BIGINT
  FROM public.campaign_audience_contacts(p_list_ids, p_tag_ids, p_stage_ids, p_type);
$$;

-- Materialise a campaign's audience into campaign_recipients in one statement.
-- Idempotent: ON CONFLICT DO NOTHING means a re-run after a partial expansion
-- (or a resend) adds only the people who are missing. Returns the campaign's
-- total recipient count, which is what process-campaigns stores as
-- total_recipients.
--
-- SECURITY DEFINER because the caller is the service-role edge function and
-- this must behave identically regardless of the invoking role.
CREATE OR REPLACE FUNCTION public.expand_campaign_recipients(p_campaign_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign RECORD;
  v_total    BIGINT;
BEGIN
  SELECT recipient_list_ids, recipient_tag_ids, recipient_stage_ids, type
    INTO v_campaign
  FROM campaigns
  WHERE id = p_campaign_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign % not found', p_campaign_id;
  END IF;

  INSERT INTO campaign_recipients (campaign_id, contact_id, status)
  SELECT p_campaign_id, a.contact_id, 'pending'
  FROM public.campaign_audience_contacts(
    COALESCE(v_campaign.recipient_list_ids, '{}'),
    COALESCE(v_campaign.recipient_tag_ids, '{}'),
    COALESCE(v_campaign.recipient_stage_ids, '{}'),
    v_campaign.type
  ) a
  ON CONFLICT (campaign_id, contact_id) DO NOTHING;

  SELECT COUNT(*)::BIGINT INTO v_total
  FROM campaign_recipients
  WHERE campaign_id = p_campaign_id;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.expand_campaign_recipients(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expand_campaign_recipients(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.campaign_audience_contacts(UUID[], UUID[], UUID[], TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.campaign_audience_count(UUID[], UUID[], UUID[], TEXT)
  TO authenticated, service_role;

-- The audience predicate probes these three join tables by contact_id.
CREATE INDEX IF NOT EXISTS idx_contact_lists_contact_list
  ON contact_lists(contact_id, list_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_contact_tag
  ON contact_tags(contact_id, tag_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact_stage_active
  ON deals(contact_id, current_stage_id)
  WHERE won_at IS NULL AND lost_at IS NULL;
