-- Contact search: match full names, and rank results
-- ==================================================
-- Two problems with the Contacts page search.
--
-- 1. It could not find anyone by full name. The typed string was passed as
--    one lump to every column, so "Aila Head" asked "is there a contact
--    whose FIRST NAME contains 'Aila Head'?" — never true. Searching a full
--    name, the most natural thing to do, returned nothing, and only an exact
--    email worked. (The contact-picker hook already split words correctly;
--    the main page never got the same treatment.)
--
-- 2. No relevance ordering. A single-word search like "Aila" matched 119 of
--    105k contacts, sorted newest-first, so the exact person could sit pages
--    deep behind partial matches.
--
-- This returns ranked contact IDs plus the total, rather than whole rows, so
-- the app keeps one definition of which columns to select and how tags are
-- attached — there is no second copy of that to fall out of step. The caller
-- re-orders the fetched rows by the returned position.
--
-- SECURITY INVOKER (the default) is deliberate: contacts is an RLS-protected
-- table and this must not become a way around that.
--
-- Performance rests on the existing GIN trigram indexes on first_name,
-- last_name and email.
--
-- The search predicate is assembled as dynamic SQL rather than written as
-- one statement covering every case. Both earlier attempts — OR-ing the
-- one-word and multi-word predicates together, then wrapping them in a
-- CASE — left the planner unable to see a usable ILIKE and it fell back to
-- a sequential scan of 105k rows (~500ms). Handing it a single concrete
-- predicate lets it use the trigram index instead.
--
-- Only the SHAPE of the predicate is composed; every value is passed as a
-- bind parameter, so a contact's name can never be interpreted as SQL.
--
-- The phone column is searched ONLY when the typed term contains a digit.
-- Partial matching on phone cannot use its btree index, and a single
-- un-indexable branch in an OR drags the entire query into a sequential
-- scan — measured at 380ms versus 1ms for the same search without it.
-- Names never contain digits, so name searches simply skip that branch,
-- and the trigram index added below keeps genuine number searches fast.

CREATE OR REPLACE FUNCTION public.search_contacts_ranked(
  p_search              text,
  p_ids                 uuid[] DEFAULT NULL,  -- pre-resolved pipeline/recruiter/tag filter
  p_subscription_status text   DEFAULT NULL,
  p_graduation_year     int    DEFAULT NULL,
  p_gender              text   DEFAULT NULL,
  p_country             text   DEFAULT NULL,
  p_position            text   DEFAULT NULL,
  p_owner_id            uuid   DEFAULT NULL,
  p_state               text   DEFAULT NULL,
  p_phone_prefix        text   DEFAULT NULL,
  p_sort_by             text   DEFAULT NULL,
  p_sort_desc           boolean DEFAULT true,
  p_limit               int    DEFAULT 25,
  p_offset              int    DEFAULT 0
)
RETURNS TABLE (id uuid, total_count bigint)
LANGUAGE plpgsql
STABLE
AS $fn$
DECLARE
  v_term    text := btrim(coalesce(p_search, ''));
  v_words   text[];
  v_first   text;   -- leading word  — matched against first_name
  v_last    text;   -- trailing word — matched against last_name
  v_phone   text[] := NULL;
  v_match   text;   -- the composed search predicate
  v_digits  boolean := v_term ~ '\d';  -- does the term look like a number?
BEGIN
  v_words := regexp_split_to_array(v_term, '\s+');
  v_first := v_words[1];
  v_last  := v_words[array_length(v_words, 1)];

  -- Area codes can follow an optional country code in several shapes.
  -- Mirrors the pattern list the client-side query builder uses.
  IF p_phone_prefix IS NOT NULL THEN
    v_phone := ARRAY[
      p_phone_prefix || '%',
      '+_'    || p_phone_prefix || '%',
      '+__'   || p_phone_prefix || '%',
      '+___'  || p_phone_prefix || '%',
      '+_ '   || p_phone_prefix || '%',
      '+__ '  || p_phone_prefix || '%',
      '+___ ' || p_phone_prefix || '%',
      '('     || p_phone_prefix || ')%',
      '+_('   || p_phone_prefix || ')%',
      '+_ ('  || p_phone_prefix || ')%',
      '0'     || p_phone_prefix || '%'
    ];
  END IF;

  IF v_term = '' THEN
    v_match := 'true';
  ELSIF array_length(v_words, 1) > 1 THEN
    -- Multi-word: treat it as a full name, in either order, so both
    -- "Aila Head" and "Head Aila" find the same person. This is the case
    -- the old single-lump search could never satisfy.
    v_match := $q$(
         (c.first_name ILIKE '%'||$11||'%' AND c.last_name ILIKE '%'||$12||'%')
      OR (c.first_name ILIKE '%'||$12||'%' AND c.last_name ILIKE '%'||$11||'%')
      OR c.email ILIKE '%'||$10||'%'
    $q$
      || CASE WHEN v_digits THEN $q$ OR c.phone ILIKE '%'||$10||'%' $q$ ELSE '' END
      || ')';
  ELSE
    -- Single word: any of the four fields may carry it.
    v_match := $q$(
         c.first_name ILIKE '%'||$10||'%'
      OR c.last_name  ILIKE '%'||$10||'%'
      OR c.email      ILIKE '%'||$10||'%'
    $q$
      || CASE WHEN v_digits THEN $q$ OR c.phone ILIKE '%'||$10||'%' $q$ ELSE '' END
      || ')';
  END IF;

  RETURN QUERY EXECUTE format($q$
    WITH matched AS (
      SELECT
        c.id,
        c.created_at,
        c.first_name,
        c.last_name,
        -- Relevance buckets, lowest first. Exact beats prefix beats
        -- contains, so "Aila" puts Aila Head above Ailani and Ailany.
        CASE
          WHEN lower(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')) = lower($10)
            OR lower(coalesce(c.email,'')) = lower($10)                          THEN 0
          WHEN lower(coalesce(c.first_name,'')) = lower($10)
            OR lower(coalesce(c.last_name,''))  = lower($10)                     THEN 1
          WHEN lower(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')) LIKE lower($10)||'%%'
            OR lower(coalesce(c.email,'')) LIKE lower($10)||'%%'                 THEN 2
          WHEN lower(coalesce(c.first_name,'')) LIKE lower($10)||'%%'
            OR lower(coalesce(c.last_name,''))  LIKE lower($10)||'%%'            THEN 3
          ELSE 4
        END AS rank
      FROM contacts c
      WHERE ($1  IS NULL OR c.id = ANY ($1))
        AND ($2  IS NULL OR c.subscription_status = $2)
        AND ($3  IS NULL OR c.graduation_year     = $3)
        AND ($4  IS NULL OR c.gender              = $4)
        AND ($5  IS NULL OR c.country             = $5)
        AND ($6  IS NULL OR c."position"          = $6)
        AND ($7  IS NULL OR c.owner_id            = $7)
        AND ($8  IS NULL OR c.state               = $8)
        AND ($9  IS NULL OR c.phone ILIKE ANY ($9))
        AND %s
    )
    SELECT m.id, count(*) OVER () AS total_count
    FROM matched m
    ORDER BY
      m.rank,
      -- An explicit column sort still wins inside a relevance bucket; with
      -- no explicit sort, newest first preserves the previous default.
      CASE WHEN $13 = 'first_name' AND NOT $14 THEN m.first_name END ASC  NULLS LAST,
      CASE WHEN $13 = 'first_name' AND     $14 THEN m.first_name END DESC NULLS LAST,
      CASE WHEN $13 = 'last_name'  AND NOT $14 THEN m.last_name  END ASC  NULLS LAST,
      CASE WHEN $13 = 'last_name'  AND     $14 THEN m.last_name  END DESC NULLS LAST,
      CASE WHEN $13 = 'created_at' AND NOT $14 THEN m.created_at END ASC  NULLS LAST,
      m.created_at DESC
    LIMIT GREATEST($15, 1) OFFSET GREATEST($16, 0)
  $q$, v_match)
  USING p_ids, p_subscription_status, p_graduation_year, p_gender, p_country,
        p_position, p_owner_id, p_state, v_phone, v_term, v_first, v_last,
        p_sort_by, p_sort_desc, p_limit, p_offset;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.search_contacts_ranked(
  text, uuid[], text, int, text, text, text, uuid, text, text, text, boolean, int, int
) TO authenticated;

COMMENT ON FUNCTION public.search_contacts_ranked IS
  'Word-aware, relevance-ranked contact search. Returns page of contact ids + total. SECURITY INVOKER so contacts RLS still applies.';

-- Lets a genuine phone-number search use an index instead of scanning every
-- row. Mirrors the trigram indexes already present on first_name, last_name
-- and email.
CREATE INDEX IF NOT EXISTS idx_contacts_phone_trgm
  ON public.contacts USING gin (phone gin_trgm_ops);
