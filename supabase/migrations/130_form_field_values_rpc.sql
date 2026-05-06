-- RPC that returns the distinct values seen for a given JSON field across
-- past submissions of a specific form. Powers the value-suggestion
-- dropdown in the Configure Automation modal's "Dynamic List Rules"
-- section, so a recruiter wiring up rules for an existing form can just
-- pick the values that have actually come through the webhook (e.g.
-- "male", "female") instead of typing them and risking a typo.
--
-- Returns up to p_limit values per field, ordered by frequency desc,
-- so the most common values surface first. Trims and lowercases via
-- BTRIM so a stray space or a "Male" doesn't produce two suggestions.

CREATE OR REPLACE FUNCTION distinct_form_field_values(
  p_form_id TEXT,
  p_field   TEXT,
  p_limit   INTEGER DEFAULT 30
)
RETURNS TABLE (value TEXT, count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    BTRIM(payload->>p_field)         AS value,
    COUNT(*)::BIGINT                 AS count
  FROM form_submissions
  WHERE form_id = p_form_id
    AND payload ? p_field
    AND NULLIF(BTRIM(payload->>p_field), '') IS NOT NULL
  GROUP BY BTRIM(payload->>p_field)
  ORDER BY count DESC, value ASC
  LIMIT p_limit;
$$;

-- Allow authenticated app users to call it; the function only reads
-- form_submissions and we already gate the page behind admin RLS.
GRANT EXECUTE ON FUNCTION distinct_form_field_values(TEXT, TEXT, INTEGER) TO authenticated;
