-- QA-31 bug 1, the SMS half.
--
-- Smart Match is one modal serving both inbound email and inbound SMS, and
-- both halves scored against the same unpaged `select('*')` on contacts — so
-- the 1,000-row cap applied to phone matching exactly as it did to email.
-- There are no SMS messages on the system yet, so nobody has hit it, but
-- leaving it would mean the ticket's root cause is only half fixed and comes
-- straight back the first time a text arrives.
--
-- The matching rules are the ones the TypeScript used:
--
--   100  exact match on the normalised number
--    90  same last 10 digits
--    80  same last 9 digits   (tolerates trunk-prefix and country-code noise)
--
-- Normalising means digits only, with a UK leading 0 rewritten to 44, which is
-- what normalizePhone() in lib/utils/smartMatch.ts did.

-- Suffix equality, not a LIKE scan: an expression index on the last 10 and
-- last 9 digits turns "same tail" into an index lookup over 165,736 numbers.
-- IMMUTABLE-safe — regexp_replace and right() both qualify.
CREATE INDEX IF NOT EXISTS idx_contacts_phone_digits_10
  ON contacts (right(regexp_replace(phone, '\D', '', 'g'), 10))
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_phone_digits_9
  ON contacts (right(regexp_replace(phone, '\D', '', 'g'), 9))
  WHERE phone IS NOT NULL;

CREATE OR REPLACE FUNCTION suggest_contact_for_sms(p_phone TEXT)
RETURNS TABLE (
  contact_id   UUID,
  confidence   INT,
  match_reason TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_digits TEXT := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  v_last10 TEXT;
  v_last9  TEXT;
BEGIN
  IF length(v_digits) = 0 THEN
    RETURN;
  END IF;

  -- UK mobile written locally: 07xxx xxxxxx -> 447xxx xxxxxx.
  IF left(v_digits, 1) = '0' AND length(v_digits) = 11 THEN
    v_digits := '44' || substr(v_digits, 2);
  END IF;

  v_last10 := right(v_digits, 10);
  v_last9  := right(v_digits, 9);

  -- Exact, on the same normalisation applied to the stored number.
  RETURN QUERY
  SELECT c.id, 100, 'Exact phone match'::TEXT
  FROM contacts c
  WHERE c.phone IS NOT NULL
    AND CASE
          WHEN left(regexp_replace(c.phone, '\D', '', 'g'), 1) = '0'
           AND length(regexp_replace(c.phone, '\D', '', 'g')) = 11
            THEN '44' || substr(regexp_replace(c.phone, '\D', '', 'g'), 2)
          ELSE regexp_replace(c.phone, '\D', '', 'g')
        END = v_digits
  LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  IF length(v_last10) = 10 THEN
    RETURN QUERY
    SELECT c.id, 90, 'Phone match (last 10 digits)'::TEXT
    FROM contacts c
    WHERE c.phone IS NOT NULL
      AND right(regexp_replace(c.phone, '\D', '', 'g'), 10) = v_last10
    LIMIT 1;

    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  IF length(v_last9) = 9 THEN
    RETURN QUERY
    SELECT c.id, 80, 'Phone match (partial)'::TEXT
    FROM contacts c
    WHERE c.phone IS NOT NULL
      AND right(regexp_replace(c.phone, '\D', '', 'g'), 9) = v_last9
    LIMIT 1;
  END IF;
END;
$$;

COMMENT ON FUNCTION suggest_contact_for_sms(TEXT) IS
  'QA-31 bug 1 (SMS half): suggests a contact for an unmatched text across all '
  'contacts, replacing a client-side scan capped at the first 1,000 rows.';

GRANT EXECUTE ON FUNCTION suggest_contact_for_sms(TEXT) TO authenticated;
