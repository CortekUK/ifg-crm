-- Scope the ranked contact search to a single tag or list.
--
-- 164 fixed full-name search on the Contacts page, but three other pickers
-- kept their own hand-rolled predicates and two of them are wrong in exactly
-- the way 164 described:
--
--   * useTagContacts    — passes the whole typed string to each column, so
--                         "Aila Head" asks whether a FIRST NAME contains
--                         "Aila Head". Never true. Full-name search finds
--                         nobody inside a tag.
--   * useSearchContacts — splits on whitespace but assumes word 1 is the
--                         first name and the last word is the surname, so
--                         "Head Aila" misses, and a multi-word term never
--                         checks email at all.
--
-- Rather than fix each copy, they now all call this one function. The two new
-- parameters let it answer "…and only among contacts carrying this tag / on
-- this list", which is what the member searches need. Appended last with
-- defaults so every existing call site is unaffected.
--
-- Dropped and recreated because adding parameters changes the signature; an
-- overload would leave PostgREST able to resolve either one.

DROP FUNCTION IF EXISTS public.search_contacts_ranked(
  text, uuid[], text, int, text, text, text, uuid, text, text, text, boolean, int, int
);

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
  p_offset              int    DEFAULT 0,
  p_tag_id              uuid   DEFAULT NULL,  -- restrict to members of this tag
  p_list_id             uuid   DEFAULT NULL   -- restrict to members of this list
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
        AND ($17 IS NULL OR EXISTS (
              SELECT 1 FROM contact_tags ct
              WHERE ct.contact_id = c.id AND ct.tag_id = $17))
        AND ($18 IS NULL OR EXISTS (
              SELECT 1 FROM contact_lists cl
              WHERE cl.contact_id = c.id AND cl.list_id = $18))
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
        p_sort_by, p_sort_desc, p_limit, p_offset, p_tag_id, p_list_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.search_contacts_ranked(
  text, uuid[], text, int, text, text, text, uuid, text, text, text, boolean,
  int, int, uuid, uuid
) TO authenticated;

COMMENT ON FUNCTION public.search_contacts_ranked IS
  'Word-aware, relevance-ranked contact search, optionally restricted to one tag or list. Returns a page of contact ids plus the total. SECURITY INVOKER so contacts RLS still applies.';
