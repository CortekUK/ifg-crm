-- QA-36 Bug 3: Scout answered the same question wrong four times running, with
-- four different wrong numbers (22, 38, 40, then 0) against a real 288.
--
-- The cause is not the query tool — it is that `contacts.state` holds the same
-- state two ways. 285 California contacts are stored as "CA" and 3 as
-- "California", so any single-spelling filter is wrong, and Scout kept writing
-- one: `state ILIKE '%California%'` finds 3, `= 'CA'` finds 285, and the
-- substring form also drags in North and South Carolina.
--
-- Telling the model to match both spellings is advice it can ignore, and it had
-- already ignored equivalent advice. So the view now carries ONE canonical
-- answer per row and the SQL validator refuses a filter on the raw column
-- (lib/scout/executors.ts), which turns a silently wrong number into an error
-- the model is told how to correct.
--
--   state_code  the 2-letter code, whichever way the row was stored
--   state_name  the full name, likewise
--   state       left exactly as it is, for display
--
-- Non-US and unrecognised values pass through unchanged in both columns rather
-- than becoming NULL, so nothing disappears from a filter.

CREATE OR REPLACE FUNCTION us_state_lookup()
RETURNS TABLE (code TEXT, name TEXT)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT * FROM (VALUES
      ('AK', 'Alaska'),
      ('AL', 'Alabama'),
      ('AR', 'Arkansas'),
      ('AZ', 'Arizona'),
      ('CA', 'California'),
      ('CO', 'Colorado'),
      ('CT', 'Connecticut'),
      ('DC', 'District of Columbia'),
      ('DE', 'Delaware'),
      ('FL', 'Florida'),
      ('GA', 'Georgia'),
      ('HI', 'Hawaii'),
      ('IA', 'Iowa'),
      ('ID', 'Idaho'),
      ('IL', 'Illinois'),
      ('IN', 'Indiana'),
      ('KS', 'Kansas'),
      ('KY', 'Kentucky'),
      ('LA', 'Louisiana'),
      ('MA', 'Massachusetts'),
      ('MD', 'Maryland'),
      ('ME', 'Maine'),
      ('MI', 'Michigan'),
      ('MN', 'Minnesota'),
      ('MO', 'Missouri'),
      ('MS', 'Mississippi'),
      ('MT', 'Montana'),
      ('NC', 'North Carolina'),
      ('ND', 'North Dakota'),
      ('NE', 'Nebraska'),
      ('NH', 'New Hampshire'),
      ('NJ', 'New Jersey'),
      ('NM', 'New Mexico'),
      ('NV', 'Nevada'),
      ('NY', 'New York'),
      ('OH', 'Ohio'),
      ('OK', 'Oklahoma'),
      ('OR', 'Oregon'),
      ('PA', 'Pennsylvania'),
      ('RI', 'Rhode Island'),
      ('SC', 'South Carolina'),
      ('SD', 'South Dakota'),
      ('TN', 'Tennessee'),
      ('TX', 'Texas'),
      ('UT', 'Utah'),
      ('VA', 'Virginia'),
      ('VT', 'Vermont'),
      ('WA', 'Washington'),
      ('WI', 'Wisconsin'),
      ('WV', 'West Virginia'),
      ('WY', 'Wyoming')
  ) AS t(code, name)
$$;

COMMENT ON FUNCTION us_state_lookup() IS
  'Code/name pairs for the 50 US states plus DC. Used to give Scout one '
  'canonical spelling per contact (QA-36 Bug 3).';

-- Rewritten as plain CASE expressions so Postgres can inline them: the
-- set-returning-function version re-scanned a 51-row VALUES list for every one
-- of 178,000 contacts.
CREATE OR REPLACE FUNCTION us_state_code(p_state TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE upper(btrim(coalesce(p_state, '')))
    WHEN 'AK' THEN 'AK'
    WHEN 'ALASKA' THEN 'AK'
    WHEN 'AL' THEN 'AL'
    WHEN 'ALABAMA' THEN 'AL'
    WHEN 'AR' THEN 'AR'
    WHEN 'ARKANSAS' THEN 'AR'
    WHEN 'AZ' THEN 'AZ'
    WHEN 'ARIZONA' THEN 'AZ'
    WHEN 'CA' THEN 'CA'
    WHEN 'CALIFORNIA' THEN 'CA'
    WHEN 'CO' THEN 'CO'
    WHEN 'COLORADO' THEN 'CO'
    WHEN 'CT' THEN 'CT'
    WHEN 'CONNECTICUT' THEN 'CT'
    WHEN 'DC' THEN 'DC'
    WHEN 'DISTRICT OF COLUMBIA' THEN 'DC'
    WHEN 'DE' THEN 'DE'
    WHEN 'DELAWARE' THEN 'DE'
    WHEN 'FL' THEN 'FL'
    WHEN 'FLORIDA' THEN 'FL'
    WHEN 'GA' THEN 'GA'
    WHEN 'GEORGIA' THEN 'GA'
    WHEN 'HI' THEN 'HI'
    WHEN 'HAWAII' THEN 'HI'
    WHEN 'IA' THEN 'IA'
    WHEN 'IOWA' THEN 'IA'
    WHEN 'ID' THEN 'ID'
    WHEN 'IDAHO' THEN 'ID'
    WHEN 'IL' THEN 'IL'
    WHEN 'ILLINOIS' THEN 'IL'
    WHEN 'IN' THEN 'IN'
    WHEN 'INDIANA' THEN 'IN'
    WHEN 'KS' THEN 'KS'
    WHEN 'KANSAS' THEN 'KS'
    WHEN 'KY' THEN 'KY'
    WHEN 'KENTUCKY' THEN 'KY'
    WHEN 'LA' THEN 'LA'
    WHEN 'LOUISIANA' THEN 'LA'
    WHEN 'MA' THEN 'MA'
    WHEN 'MASSACHUSETTS' THEN 'MA'
    WHEN 'MD' THEN 'MD'
    WHEN 'MARYLAND' THEN 'MD'
    WHEN 'ME' THEN 'ME'
    WHEN 'MAINE' THEN 'ME'
    WHEN 'MI' THEN 'MI'
    WHEN 'MICHIGAN' THEN 'MI'
    WHEN 'MN' THEN 'MN'
    WHEN 'MINNESOTA' THEN 'MN'
    WHEN 'MO' THEN 'MO'
    WHEN 'MISSOURI' THEN 'MO'
    WHEN 'MS' THEN 'MS'
    WHEN 'MISSISSIPPI' THEN 'MS'
    WHEN 'MT' THEN 'MT'
    WHEN 'MONTANA' THEN 'MT'
    WHEN 'NC' THEN 'NC'
    WHEN 'NORTH CAROLINA' THEN 'NC'
    WHEN 'ND' THEN 'ND'
    WHEN 'NORTH DAKOTA' THEN 'ND'
    WHEN 'NE' THEN 'NE'
    WHEN 'NEBRASKA' THEN 'NE'
    WHEN 'NH' THEN 'NH'
    WHEN 'NEW HAMPSHIRE' THEN 'NH'
    WHEN 'NJ' THEN 'NJ'
    WHEN 'NEW JERSEY' THEN 'NJ'
    WHEN 'NM' THEN 'NM'
    WHEN 'NEW MEXICO' THEN 'NM'
    WHEN 'NV' THEN 'NV'
    WHEN 'NEVADA' THEN 'NV'
    WHEN 'NY' THEN 'NY'
    WHEN 'NEW YORK' THEN 'NY'
    WHEN 'OH' THEN 'OH'
    WHEN 'OHIO' THEN 'OH'
    WHEN 'OK' THEN 'OK'
    WHEN 'OKLAHOMA' THEN 'OK'
    WHEN 'OR' THEN 'OR'
    WHEN 'OREGON' THEN 'OR'
    WHEN 'PA' THEN 'PA'
    WHEN 'PENNSYLVANIA' THEN 'PA'
    WHEN 'RI' THEN 'RI'
    WHEN 'RHODE ISLAND' THEN 'RI'
    WHEN 'SC' THEN 'SC'
    WHEN 'SOUTH CAROLINA' THEN 'SC'
    WHEN 'SD' THEN 'SD'
    WHEN 'SOUTH DAKOTA' THEN 'SD'
    WHEN 'TN' THEN 'TN'
    WHEN 'TENNESSEE' THEN 'TN'
    WHEN 'TX' THEN 'TX'
    WHEN 'TEXAS' THEN 'TX'
    WHEN 'UT' THEN 'UT'
    WHEN 'UTAH' THEN 'UT'
    WHEN 'VA' THEN 'VA'
    WHEN 'VIRGINIA' THEN 'VA'
    WHEN 'VT' THEN 'VT'
    WHEN 'VERMONT' THEN 'VT'
    WHEN 'WA' THEN 'WA'
    WHEN 'WASHINGTON' THEN 'WA'
    WHEN 'WI' THEN 'WI'
    WHEN 'WISCONSIN' THEN 'WI'
    WHEN 'WV' THEN 'WV'
    WHEN 'WEST VIRGINIA' THEN 'WV'
    WHEN 'WY' THEN 'WY'
    WHEN 'WYOMING' THEN 'WY'
    ELSE nullif(btrim(p_state), '')
  END
$$;

CREATE OR REPLACE FUNCTION us_state_name(p_state TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE upper(btrim(coalesce(p_state, '')))
    WHEN 'AK' THEN 'Alaska'
    WHEN 'ALASKA' THEN 'Alaska'
    WHEN 'AL' THEN 'Alabama'
    WHEN 'ALABAMA' THEN 'Alabama'
    WHEN 'AR' THEN 'Arkansas'
    WHEN 'ARKANSAS' THEN 'Arkansas'
    WHEN 'AZ' THEN 'Arizona'
    WHEN 'ARIZONA' THEN 'Arizona'
    WHEN 'CA' THEN 'California'
    WHEN 'CALIFORNIA' THEN 'California'
    WHEN 'CO' THEN 'Colorado'
    WHEN 'COLORADO' THEN 'Colorado'
    WHEN 'CT' THEN 'Connecticut'
    WHEN 'CONNECTICUT' THEN 'Connecticut'
    WHEN 'DC' THEN 'District of Columbia'
    WHEN 'DISTRICT OF COLUMBIA' THEN 'District of Columbia'
    WHEN 'DE' THEN 'Delaware'
    WHEN 'DELAWARE' THEN 'Delaware'
    WHEN 'FL' THEN 'Florida'
    WHEN 'FLORIDA' THEN 'Florida'
    WHEN 'GA' THEN 'Georgia'
    WHEN 'GEORGIA' THEN 'Georgia'
    WHEN 'HI' THEN 'Hawaii'
    WHEN 'HAWAII' THEN 'Hawaii'
    WHEN 'IA' THEN 'Iowa'
    WHEN 'IOWA' THEN 'Iowa'
    WHEN 'ID' THEN 'Idaho'
    WHEN 'IDAHO' THEN 'Idaho'
    WHEN 'IL' THEN 'Illinois'
    WHEN 'ILLINOIS' THEN 'Illinois'
    WHEN 'IN' THEN 'Indiana'
    WHEN 'INDIANA' THEN 'Indiana'
    WHEN 'KS' THEN 'Kansas'
    WHEN 'KANSAS' THEN 'Kansas'
    WHEN 'KY' THEN 'Kentucky'
    WHEN 'KENTUCKY' THEN 'Kentucky'
    WHEN 'LA' THEN 'Louisiana'
    WHEN 'LOUISIANA' THEN 'Louisiana'
    WHEN 'MA' THEN 'Massachusetts'
    WHEN 'MASSACHUSETTS' THEN 'Massachusetts'
    WHEN 'MD' THEN 'Maryland'
    WHEN 'MARYLAND' THEN 'Maryland'
    WHEN 'ME' THEN 'Maine'
    WHEN 'MAINE' THEN 'Maine'
    WHEN 'MI' THEN 'Michigan'
    WHEN 'MICHIGAN' THEN 'Michigan'
    WHEN 'MN' THEN 'Minnesota'
    WHEN 'MINNESOTA' THEN 'Minnesota'
    WHEN 'MO' THEN 'Missouri'
    WHEN 'MISSOURI' THEN 'Missouri'
    WHEN 'MS' THEN 'Mississippi'
    WHEN 'MISSISSIPPI' THEN 'Mississippi'
    WHEN 'MT' THEN 'Montana'
    WHEN 'MONTANA' THEN 'Montana'
    WHEN 'NC' THEN 'North Carolina'
    WHEN 'NORTH CAROLINA' THEN 'North Carolina'
    WHEN 'ND' THEN 'North Dakota'
    WHEN 'NORTH DAKOTA' THEN 'North Dakota'
    WHEN 'NE' THEN 'Nebraska'
    WHEN 'NEBRASKA' THEN 'Nebraska'
    WHEN 'NH' THEN 'New Hampshire'
    WHEN 'NEW HAMPSHIRE' THEN 'New Hampshire'
    WHEN 'NJ' THEN 'New Jersey'
    WHEN 'NEW JERSEY' THEN 'New Jersey'
    WHEN 'NM' THEN 'New Mexico'
    WHEN 'NEW MEXICO' THEN 'New Mexico'
    WHEN 'NV' THEN 'Nevada'
    WHEN 'NEVADA' THEN 'Nevada'
    WHEN 'NY' THEN 'New York'
    WHEN 'NEW YORK' THEN 'New York'
    WHEN 'OH' THEN 'Ohio'
    WHEN 'OHIO' THEN 'Ohio'
    WHEN 'OK' THEN 'Oklahoma'
    WHEN 'OKLAHOMA' THEN 'Oklahoma'
    WHEN 'OR' THEN 'Oregon'
    WHEN 'OREGON' THEN 'Oregon'
    WHEN 'PA' THEN 'Pennsylvania'
    WHEN 'PENNSYLVANIA' THEN 'Pennsylvania'
    WHEN 'RI' THEN 'Rhode Island'
    WHEN 'RHODE ISLAND' THEN 'Rhode Island'
    WHEN 'SC' THEN 'South Carolina'
    WHEN 'SOUTH CAROLINA' THEN 'South Carolina'
    WHEN 'SD' THEN 'South Dakota'
    WHEN 'SOUTH DAKOTA' THEN 'South Dakota'
    WHEN 'TN' THEN 'Tennessee'
    WHEN 'TENNESSEE' THEN 'Tennessee'
    WHEN 'TX' THEN 'Texas'
    WHEN 'TEXAS' THEN 'Texas'
    WHEN 'UT' THEN 'Utah'
    WHEN 'UTAH' THEN 'Utah'
    WHEN 'VA' THEN 'Virginia'
    WHEN 'VIRGINIA' THEN 'Virginia'
    WHEN 'VT' THEN 'Vermont'
    WHEN 'VERMONT' THEN 'Vermont'
    WHEN 'WA' THEN 'Washington'
    WHEN 'WASHINGTON' THEN 'Washington'
    WHEN 'WI' THEN 'Wisconsin'
    WHEN 'WISCONSIN' THEN 'Wisconsin'
    WHEN 'WV' THEN 'West Virginia'
    WHEN 'WEST VIRGINIA' THEN 'West Virginia'
    WHEN 'WY' THEN 'Wyoming'
    WHEN 'WYOMING' THEN 'Wyoming'
    ELSE nullif(btrim(p_state), '')
  END
$$;

GRANT EXECUTE ON FUNCTION us_state_lookup() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION us_state_code(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION us_state_name(TEXT) TO authenticated, service_role;

-- Two canonical state columns on the contacts view.
--
-- `state` is left untouched for display; these are what any filter should use.
-- 285 California contacts are stored as "CA" and 3 as "California", so a filter
-- on the raw column is wrong whichever spelling it picks — which is how Scout
-- answered 22, then 38, then 40, then 0, against a real 288 (QA-36 Bug 3).
CREATE OR REPLACE VIEW v_scout_contacts AS
 SELECT c.id,
    c.first_name,
    c.last_name,
    (c.first_name || ' '::text) || c.last_name AS full_name,
    c.email,
    c.phone,
    c.date_of_birth,
    c.graduation_year,
    c.gender,
    c.country,
    c.state,
    c.city,
    c.club_name,
    c."position",
    c.gpa,
    c.sport,
    c.parent_name AS guardian_name,
    c.parent_email AS guardian_email,
    c.parent_phone AS guardian_phone,
    c.source,
    c.source_detail,
    c.subscription_status,
    c.email_subscribed,
    c.sms_subscribed,
    c.preferred_programme,
    c.notes,
    c.custom_fields,
    c.owner_id,
    owner.full_name AS owner_name,
    c.last_activity_at,
    c.created_at,
    c.updated_at,
    ( SELECT count(*) AS count
           FROM deals d
          WHERE d.contact_id = c.id) AS deal_count,
    ( SELECT count(*) AS count
           FROM invoices i
          WHERE i.contact_id = c.id) AS invoice_count,
    ( SELECT count(*) AS count
           FROM contact_lists cl
          WHERE cl.contact_id = c.id) AS list_count,
    -- Appended last: CREATE OR REPLACE VIEW can only ADD columns at the end.
    us_state_code(c.state) AS state_code,
    us_state_name(c.state) AS state_name
   FROM contacts c
     LEFT JOIN profiles owner ON owner.id = c.owner_id;

GRANT SELECT ON v_scout_contacts TO authenticated, service_role;
