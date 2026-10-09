-- Scout answered "I'm currently unable to retrieve that due to a technical
-- issue" to every question that needed its free-form SQL tool: the outstanding
-- invoice total, the Parent Email tag count, abandoned deposits, the 60-day
-- contacts chart (QA-36 new issue, QA-37 bugs 1-3).
--
-- The function wraps the supplied statement as a subquery:
--
--     SELECT jsonb_agg(t) FROM (<p_sql>) AS t
--
-- so a statement ending in a semicolon became `FROM (SELECT ...;) AS t` and
-- failed with "syntax error at or near ;", and one ending in a `--` comment
-- commented out the generated `) AS t`. A model writes both endings constantly.
-- The caller now sends a normalised statement (lib/scout/executors.ts), and
-- this is the second line of defence so the function is safe to call by hand
-- and from the SQL editor, which is how it was being tested when it "worked".
--
-- Read-only enforcement is unchanged: trailing noise is removed BEFORE the
-- forbidden-pattern work the TypeScript layer does, and `;` stripping here
-- cannot join two statements — a semicolon with anything after it is still
-- rejected upstream, and transaction_read_only still blocks any DML.

CREATE OR REPLACE FUNCTION public.scout_run_readonly_sql(p_sql TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_result JSONB;
  v_sql    TEXT;
BEGIN
  SET LOCAL transaction_read_only = ON;

  v_sql := btrim(p_sql);

  -- Drop a trailing line comment, then any trailing semicolons, repeatedly:
  -- "SELECT 1; -- done" needs both passes.
  FOR i IN 1..10 LOOP
    DECLARE
      v_before TEXT := v_sql;
    BEGIN
      v_sql := btrim(regexp_replace(v_sql, '--[^\n]*$', ''));
      v_sql := btrim(regexp_replace(v_sql, ';+$', ''));
      EXIT WHEN v_sql = v_before;
    END;
  END LOOP;

  IF v_sql = '' THEN
    RAISE EXCEPTION 'scout_run_readonly_sql: empty statement';
  END IF;

  EXECUTE format('SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (%s) AS t', v_sql)
  INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.scout_run_readonly_sql(TEXT) IS
  'Scout escape hatch: runs a validated read-only SELECT and returns rows as JSONB. Tolerates a trailing semicolon or line comment.';

REVOKE ALL ON FUNCTION public.scout_run_readonly_sql(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.scout_run_readonly_sql(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.scout_run_readonly_sql(TEXT) TO service_role;

-- While here: keep Scout's abandoned-deposit flag in step with the Invoices
-- page. Migration 212 gave staff a way to clear a chased drop-off
-- (abandoned_handled_at); the page honours it, this flag did not, so Scout
-- would keep reporting rows the office had already dealt with.
CREATE OR REPLACE VIEW v_scout_invoices AS
SELECT
  i.id,
  i.invoice_number,
  i.contact_id,
  c.first_name AS contact_first_name,
  c.last_name AS contact_last_name,
  (c.first_name || ' '::text) || c.last_name AS contact_name,
  c.email AS contact_email,
  i.deal_id,
  d.title AS deal_title,
  d.pipeline_id,
  pl.name AS pipeline_name,
  i.type AS invoice_type,
  i.description,
  i.amount,
  i.currency,
  i.status,
  i.payment_method,
  i.recipient_type,
  i.due_date,
  i.sent_at,
  i.paid_at,
  i.created_at,
  i.updated_at,
  CASE
    WHEN i.paid_at IS NOT NULL THEN 0
    WHEN i.due_date IS NULL THEN NULL::integer
    WHEN i.due_date < CURRENT_DATE THEN CURRENT_DATE - i.due_date
    ELSE 0
  END AS days_overdue,
  i.created_by_id,
  creator.full_name AS created_by_name,
  (
    i.stripe_checkout_session_id IS NOT NULL
    AND i.type = ANY (ARRAY['deposit'::text, 'full_payment'::text])
    AND i.status = ANY (ARRAY['draft'::text, 'sent'::text, 'overdue'::text])
    AND i.abandoned_handled_at IS NULL
  ) AS is_abandoned_deposit
FROM invoices i
  LEFT JOIN contacts c ON c.id = i.contact_id
  LEFT JOIN deals d ON d.id = i.deal_id
  LEFT JOIN pipelines pl ON pl.id = d.pipeline_id
  LEFT JOIN profiles creator ON creator.id = i.created_by_id;

GRANT SELECT ON v_scout_invoices TO authenticated, service_role;
