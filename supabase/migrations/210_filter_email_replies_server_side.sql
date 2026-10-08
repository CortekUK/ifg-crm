-- QA-33 bug 1 — the intent chips and the search only ever saw one page.
--
-- The Replies screen loads 20 rows at a time behind a Load More button, and
-- every filter was applied in the browser to whatever had been loaded so far.
-- So on the Matched tab the tab badge read 30 while the chips read "All 20",
-- with Positive/Question/Negative counted from those 20 only. Filtering by
-- "Positive" searched the same 20 rows, and older positive replies stayed
-- hidden until the recruiter kept pressing Load More — in the one view the
-- ticket says recruiters live in.
--
-- Filtering moves to the database so the counts describe the whole tab and a
-- filter reaches every reply, not just the loaded ones.
--
-- There is deliberately ONE definition of "which replies are in view"
-- (email_replies_in_view), which both the page query and the chip counts read.
-- The same screen already showed what happens when a predicate is restated:
-- the list filtered on four fields while the counts counted a fifth.
--
-- SECURITY INVOKER (the default) is load-bearing: row-level security on
-- email_replies keeps applying as the calling user. QA-33 raised an open
-- question about what recruiters should see, and that is for Ghulam to answer
-- — these functions must not quietly decide it by running as the owner.

CREATE EXTENSION IF NOT EXISTS unaccent;

-- Accent-folded, lowercased, whitespace-collapsed — the same normalisation
-- lib/utils/deal-search.ts applies, so "Jose" still finds "José" now the
-- matching happens in SQL.
CREATE OR REPLACE FUNCTION reply_search_normalise(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT btrim(regexp_replace(lower(unaccent(COALESCE(p_text, ''))), '\s+', ' ', 'g'))
$$;

/**
 * Which replies are in view, for a tab and a set of filters.
 *
 * p_campaign / p_pipeline take the sentinels the UI already uses:
 *   'all'  — no restriction
 *   'none' — replies with no campaign / no pipeline at all
 *   <uuid> — that campaign / pipeline
 *
 * Search matches word by word: every word must appear somewhere across the
 * sender, the subject, the body and the matched contact's name, in any order.
 * That is what the board's matchesTokens does, so "john smith" finds a reply
 * however the name is stored and in whichever order it is typed.
 */
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
      WHEN r.ai_intent IN ('positive', 'question', 'negative', 'neutral') THEN r.ai_intent
      ELSE 'unknown'
    END AS intent
  FROM email_replies r
  LEFT JOIN contacts c ON c.id = r.contact_id
  CROSS JOIN terms
  WHERE
    CASE p_tab
      WHEN 'unmatched' THEN r.match_status = 'unmatched'
      -- Matched shows UNREAD only; reading one archives it to the All tab.
      WHEN 'matched'   THEN r.match_status IN ('auto_matched', 'manually_matched')
                            AND COALESCE(r.read, false) = false
      WHEN 'spam'      THEN r.match_status = 'spam'
      ELSE TRUE -- 'all'
    END
    AND (p_contact_id IS NULL OR r.contact_id = p_contact_id)
    AND (
      p_campaign = 'all'
      OR (p_campaign = 'none' AND r.campaign_id IS NULL)
      OR (p_campaign NOT IN ('all', 'none') AND r.campaign_id = p_campaign::uuid)
    )
    AND (
      p_pipeline = 'all'
      OR (p_pipeline = 'none' AND r.pipeline_id IS NULL)
      OR (p_pipeline NOT IN ('all', 'none') AND r.pipeline_id = p_pipeline::uuid)
    )
    AND (
      terms.patterns IS NULL
      OR reply_search_normalise(
           concat_ws(' ',
             r.from_email, r.from_name, r.subject, r.body,
             c.first_name, c.last_name, c.email
           )
         ) ILIKE ALL (terms.patterns)
    )
$$;

COMMENT ON FUNCTION email_replies_in_view(TEXT, TEXT, TEXT, TEXT, UUID) IS
  'QA-33 bug 1: the single definition of which replies a tab and its filters '
  'are showing. Read by both email_replies_page and email_replies_intent_counts.';

/** One page of replies, newest first, plus the total the filter matches. */
CREATE OR REPLACE FUNCTION email_replies_page(
  p_tab        TEXT DEFAULT 'unmatched',
  p_intent     TEXT DEFAULT NULL,
  p_search     TEXT DEFAULT NULL,
  p_campaign   TEXT DEFAULT 'all',
  p_pipeline   TEXT DEFAULT 'all',
  p_contact_id UUID DEFAULT NULL,
  p_limit      INT  DEFAULT 20,
  p_offset     INT  DEFAULT 0
)
RETURNS TABLE (
  id          UUID,
  total_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH v AS (
    SELECT *
    FROM email_replies_in_view(p_tab, p_search, p_campaign, p_pipeline, p_contact_id)
    WHERE p_intent IS NULL OR p_intent = 'all' OR intent = p_intent
  )
  SELECT v.id, count(*) OVER () AS total_count
  FROM v
  -- id tiebreak so paging never skips or repeats a row when two replies share
  -- a received_at — the same trap orderContacts() documents for contacts.
  ORDER BY v.received_at DESC NULLS LAST, v.id
  LIMIT p_limit
  OFFSET p_offset
$$;

GRANT EXECUTE ON FUNCTION email_replies_page(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, INT, INT) TO authenticated;

/** Chip counts for the whole tab, not just the page that happens to be loaded. */
CREATE OR REPLACE FUNCTION email_replies_intent_counts(
  p_tab        TEXT DEFAULT 'unmatched',
  p_search     TEXT DEFAULT NULL,
  p_campaign   TEXT DEFAULT 'all',
  p_pipeline   TEXT DEFAULT 'all',
  p_contact_id UUID DEFAULT NULL
)
RETURNS TABLE (
  all_count BIGINT,
  positive  BIGINT,
  question  BIGINT,
  negative  BIGINT,
  neutral   BIGINT,
  unknown   BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    count(*),
    count(*) FILTER (WHERE intent = 'positive'),
    count(*) FILTER (WHERE intent = 'question'),
    count(*) FILTER (WHERE intent = 'negative'),
    count(*) FILTER (WHERE intent = 'neutral'),
    count(*) FILTER (WHERE intent = 'unknown')
  FROM email_replies_in_view(p_tab, p_search, p_campaign, p_pipeline, p_contact_id)
$$;

GRANT EXECUTE ON FUNCTION email_replies_intent_counts(TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION email_replies_in_view(TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reply_search_normalise(TEXT) TO authenticated;

-- The campaign and pipeline dropdowns had a quieter version of the same bug:
-- their options were collected from the replies already loaded, so a campaign
-- whose replies were all on page 3 was not offered as a filter at all. Derived
-- from the whole tab instead, and only options that really have replies in it,
-- so choosing one can never give an empty list.
CREATE OR REPLACE FUNCTION email_reply_filter_options(
  p_tab        TEXT DEFAULT 'unmatched',
  p_contact_id UUID DEFAULT NULL
)
RETURNS TABLE (
  kind TEXT,
  id   UUID,
  name TEXT
)
LANGUAGE sql
STABLE
AS $$
  WITH v AS (
    SELECT id FROM email_replies_in_view(p_tab, NULL, 'all', 'all', p_contact_id)
  )
  SELECT DISTINCT 'campaign'::TEXT, cp.id, COALESCE(cp.name, 'Untitled campaign')
  FROM email_replies r
  JOIN v ON v.id = r.id
  JOIN campaigns cp ON cp.id = r.campaign_id
  UNION ALL
  SELECT DISTINCT 'pipeline'::TEXT, pl.id, COALESCE(pl.name, 'Untitled pipeline')
  FROM email_replies r
  JOIN v ON v.id = r.id
  JOIN pipelines pl ON pl.id = r.pipeline_id
$$;

GRANT EXECUTE ON FUNCTION email_reply_filter_options(TEXT, UUID) TO authenticated;
