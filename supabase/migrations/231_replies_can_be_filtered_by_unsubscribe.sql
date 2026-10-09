-- Follow-on from migration 230, which added the 'unsubscribe' reply label.
--
-- The server-side Replies list buckets anything it does not recognise into
-- 'unknown' so the chips always add up to the total (migration 210). That rule
-- was written before 'unsubscribe' existed, so a reply asking to stop would be
-- filed under "Unclassified" — the one label staff most need to find would be
-- the hardest to see, and the Unsubscribe chip would always read 0.
--
-- The counts function gains a column, so it has to be dropped and recreated
-- rather than replaced.

CREATE OR REPLACE FUNCTION email_replies_in_view(
  p_tab        TEXT DEFAULT 'unmatched',
  p_search     TEXT DEFAULT NULL,
  p_campaign   TEXT DEFAULT 'all',
  p_pipeline   TEXT DEFAULT 'all',
  p_contact_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id          UUID,
  received_at TIMESTAMPTZ,
  intent      TEXT
)
LANGUAGE sql
STABLE
AS $$
  WITH terms AS (
    SELECT CASE
             WHEN reply_search_normalise(p_search) = '' THEN NULL
             ELSE (
               SELECT array_agg('%' || t || '%')
               FROM unnest(string_to_array(reply_search_normalise(p_search), ' ')) AS t
               WHERE t <> ''
             )
           END AS patterns
  )
  SELECT
    r.id,
    r.received_at,
    -- One bucketing rule. 'unknown' absorbs NULL (never classified), the
    -- literal 'unknown', and any value the classifier may add later, so the
    -- chips always add up to the total.
    CASE
      WHEN r.ai_intent IN ('positive', 'question', 'negative', 'neutral', 'unsubscribe')
        THEN r.ai_intent
      ELSE 'unknown'
    END AS intent
  FROM email_replies r
  LEFT JOIN contacts c ON c.id = r.contact_id
  CROSS JOIN terms
  WHERE
    CASE p_tab
      WHEN 'unmatched' THEN r.match_status = 'unmatched'
      WHEN 'matched'   THEN r.match_status IN ('auto_matched', 'manually_matched')
                            AND COALESCE(r.read, false) = false
      WHEN 'spam'      THEN r.match_status = 'spam'
      ELSE TRUE -- 'all'
    END
    AND (p_contact_id IS NULL OR r.contact_id = p_contact_id)
    AND (
      p_campaign = 'all'
      OR (p_campaign = 'none' AND r.campaign_id IS NULL)
      OR r.campaign_id::TEXT = p_campaign
    )
    AND (
      p_pipeline = 'all'
      OR (p_pipeline = 'none' AND r.pipeline_id IS NULL)
      OR r.pipeline_id::TEXT = p_pipeline
    )
    AND (
      terms.patterns IS NULL
      OR (
        SELECT bool_and(
          reply_search_normalise(
            COALESCE(r.from_email, '') || ' ' ||
            COALESCE(r.from_name, '') || ' ' ||
            COALESCE(r.subject, '') || ' ' ||
            COALESCE(r.body, '') || ' ' ||
            COALESCE(c.first_name, '') || ' ' ||
            COALESCE(c.last_name, '') || ' ' ||
            COALESCE(c.email, '')
          ) LIKE pat
        )
        FROM unnest(terms.patterns) AS pat
      )
    )
$$;

DROP FUNCTION IF EXISTS email_replies_intent_counts(TEXT, TEXT, TEXT, TEXT, UUID);

CREATE FUNCTION email_replies_intent_counts(
  p_tab        TEXT DEFAULT 'unmatched',
  p_search     TEXT DEFAULT NULL,
  p_campaign   TEXT DEFAULT 'all',
  p_pipeline   TEXT DEFAULT 'all',
  p_contact_id UUID DEFAULT NULL
)
RETURNS TABLE (
  all_count   BIGINT,
  positive    BIGINT,
  question    BIGINT,
  negative    BIGINT,
  unsubscribe BIGINT,
  neutral     BIGINT,
  unknown     BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    count(*),
    count(*) FILTER (WHERE intent = 'positive'),
    count(*) FILTER (WHERE intent = 'question'),
    count(*) FILTER (WHERE intent = 'negative'),
    count(*) FILTER (WHERE intent = 'unsubscribe'),
    count(*) FILTER (WHERE intent = 'neutral'),
    count(*) FILTER (WHERE intent = 'unknown')
  FROM email_replies_in_view(p_tab, p_search, p_campaign, p_pipeline, p_contact_id)
$$;

GRANT EXECUTE ON FUNCTION email_replies_intent_counts(TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION email_replies_in_view(TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
