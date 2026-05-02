-- ============================================================================
-- Migration 114: scout_run_readonly_sql RPC
-- ============================================================================
-- The Scout escape-hatch tool (execute_readonly_sql) needs to run arbitrary
-- SELECT statements over the v_scout_* views. We do server-side validation in
-- TypeScript first (lib/scout/executors.ts → validateReadonlyScoutSql), then
-- this RPC enforces a second layer:
--
--   1. The RPC is declared SECURITY INVOKER, so it can't elevate privileges.
--   2. It opens a READ ONLY transaction inside the function — any sneaky
--      DML in the supplied SQL fails at the engine level, not just at the
--      regex layer.
--   3. The function only runs from the service-role client (the API route
--      gates that on profiles.role = 'super_admin'), and it returns rows as
--      JSONB so the route can stream them back without column-shape juggling.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.scout_run_readonly_sql(p_sql TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Belt + braces: enforce read-only at the engine level for the duration of
  -- this function. A sneaky UPDATE that slipped past the TS-side regex will
  -- still fail here with "cannot execute UPDATE in a read-only transaction".
  SET LOCAL transaction_read_only = ON;

  EXECUTE format('SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (%s) AS t', p_sql)
  INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.scout_run_readonly_sql(TEXT) IS
  'Scout escape hatch: runs a validated read-only SELECT and returns rows as JSONB.';

-- Only the service role can invoke this. The Scout API route uses the service
-- role client after a super_admin gate, so authenticated end-users never
-- reach this function directly.
REVOKE ALL ON FUNCTION public.scout_run_readonly_sql(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.scout_run_readonly_sql(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.scout_run_readonly_sql(TEXT) TO service_role;
