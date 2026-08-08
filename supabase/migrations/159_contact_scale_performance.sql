-- Make the contact-facing pages hold up at 105k contacts.
--
-- Several pages fetched whole tables and reduced them in JavaScript. That was
-- invisible with a few hundred contacts, but PostgREST caps a response at 1000
-- rows, so past that the pages did not merely get slow — they got the wrong
-- answer:
--   * Tags counted 1000 of 351,964 contact_tags rows.
--   * The contact filter dropdowns listed only the positions/states/countries
--     found in the first 1000 of 105,275 contacts.
--
-- The fix is the approach migration 063 already took for lists: aggregate in
-- the database and return the answer, not the ingredients. These functions are
-- deliberately SECURITY INVOKER (like get_list_contact_counts) so row-level
-- security still applies and a recruiter sees counts for their own contacts.

-- ── 1. Tag contact counts ────────────────────────────────────────────────
-- Replaces `select tag_id from contact_tags` + counting client-side.
CREATE OR REPLACE FUNCTION get_tag_contact_counts()
RETURNS TABLE(tag_id UUID, contact_count BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT ct.tag_id, COUNT(*) AS contact_count
  FROM contact_tags ct
  GROUP BY ct.tag_id;
$$;

GRANT EXECUTE ON FUNCTION get_tag_contact_counts() TO authenticated;

-- ── 2. Distinct filter options ───────────────────────────────────────────
-- One round trip for every dropdown on the contacts filter bar, replacing
-- three full-table fetches.
CREATE OR REPLACE FUNCTION get_contact_filter_options()
RETURNS TABLE(kind TEXT, value TEXT)
LANGUAGE sql STABLE
AS $$
  SELECT 'position', position FROM contacts
  WHERE position IS NOT NULL AND position <> ''
  GROUP BY position
  UNION ALL
  SELECT 'state', state FROM contacts
  WHERE state IS NOT NULL AND state <> ''
  GROUP BY state
  UNION ALL
  SELECT 'country', country FROM contacts
  WHERE country IS NOT NULL AND country <> ''
  GROUP BY country
  ORDER BY 1, 2;
$$;

GRANT EXECUTE ON FUNCTION get_contact_filter_options() TO authenticated;

-- ── 3. Contact stats in one call ─────────────────────────────────────────
-- Replaces three separate exact counts plus a full read of deals.
CREATE OR REPLACE FUNCTION get_contact_stats()
RETURNS TABLE(
  total_contacts BIGINT,
  new_this_month BIGINT,
  subscribed BIGINT,
  with_deals BIGINT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    (SELECT COUNT(*) FROM contacts),
    (SELECT COUNT(*) FROM contacts WHERE created_at >= date_trunc('month', NOW())),
    (SELECT COUNT(*) FROM contacts WHERE subscription_status = 'subscribed'),
    (SELECT COUNT(DISTINCT contact_id) FROM deals WHERE won_at IS NULL AND lost_at IS NULL);
$$;

GRANT EXECUTE ON FUNCTION get_contact_stats() TO authenticated;

-- ── 4. Row-level security: stop scanning the contacts table ──────────────
-- `contact_id IN (SELECT id FROM contacts)` builds the full set of visible
-- contacts before it can check a single row. EXISTS expresses the same rule —
-- "is there a contact I'm allowed to see with this id" — but correlates on the
-- primary key, so it is an index lookup. Semantics are unchanged: the inner
-- read still passes through the contacts policies, so a recruiter still only
-- matches their own contacts.

DROP POLICY IF EXISTS "contact_tags_select" ON contact_tags;
CREATE POLICY "contact_tags_select" ON contact_tags FOR SELECT TO authenticated
  USING (is_admin() OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_tags.contact_id));

DROP POLICY IF EXISTS "contact_tags_update" ON contact_tags;
CREATE POLICY "contact_tags_update" ON contact_tags FOR UPDATE TO authenticated
  USING (is_admin() OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_tags.contact_id));

DROP POLICY IF EXISTS "contact_tags_delete" ON contact_tags;
CREATE POLICY "contact_tags_delete" ON contact_tags FOR DELETE TO authenticated
  USING (is_admin() OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_tags.contact_id));

DROP POLICY IF EXISTS "contact_lists_select" ON contact_lists;
CREATE POLICY "contact_lists_select" ON contact_lists FOR SELECT TO authenticated
  USING (is_admin() OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_lists.contact_id));

DROP POLICY IF EXISTS "contact_lists_update" ON contact_lists;
CREATE POLICY "contact_lists_update" ON contact_lists FOR UPDATE TO authenticated
  USING (is_admin() OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_lists.contact_id));

DROP POLICY IF EXISTS "contact_lists_delete" ON contact_lists;
CREATE POLICY "contact_lists_delete" ON contact_lists FOR DELETE TO authenticated
  USING (is_admin() OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_lists.contact_id));

-- ── 5. Indexes for search and filtering ──────────────────────────────────
-- The contacts search runs ILIKE '%term%' across names and email, which no
-- btree index can serve. Trigram indexes make those searches index-backed
-- instead of a sequential scan over every contact.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_contacts_first_name_trgm
  ON contacts USING gin (first_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_last_name_trgm
  ON contacts USING gin (last_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_email_trgm
  ON contacts USING gin (email gin_trgm_ops);

-- Filters that were previously unindexed and now run over 105k rows.
CREATE INDEX IF NOT EXISTS idx_contacts_position ON contacts(position);
CREATE INDEX IF NOT EXISTS idx_contacts_state ON contacts(state);
CREATE INDEX IF NOT EXISTS idx_contacts_country ON contacts(country);
CREATE INDEX IF NOT EXISTS idx_contacts_gender ON contacts(gender);

-- Row estimates drive every plan above; refresh them after the bulk import.
ANALYZE contacts;
ANALYZE contact_tags;
ANALYZE contact_lists;
