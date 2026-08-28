-- Same 1000-row problem 063 solved for lists, still present for tags.
--
-- The campaign composer counted each tag's contacts by selecting every row of
-- contact_tags and tallying client-side. That table holds 352,195 rows and
-- PostgREST returns at most 1,000, so the tag picker showed "0 contacts"
-- against nearly all 220 tags — the counts looked like missing data.

CREATE OR REPLACE FUNCTION get_tag_contact_counts()
RETURNS TABLE(tag_id UUID, contact_count BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT ct.tag_id, COUNT(*) AS contact_count
  FROM contact_tags ct
  GROUP BY ct.tag_id;
$$;

GRANT EXECUTE ON FUNCTION get_tag_contact_counts() TO authenticated;
