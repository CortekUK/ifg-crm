-- QA-57 Issue 2 (hardening): a revoked guardian must lose the player's data
-- immediately, not merely be redirected.
--
-- Migration 223 sets is_active = false on the old guardian the moment the
-- parent email changes, and the middleware signs a deactivated account out on
-- its next page request. But the middleware only guards PAGES: it skips
-- /api/* by design, and it cannot touch a token that is used against
-- PostgREST directly. The access token already issued stays valid until it
-- expires, and none of the row-level policies looked at is_active — so for
-- that window a revoked parent could still read the player's contact details,
-- deals and invoices.
--
-- get_player_contact_id() is the single gate for the PLAYER branch of every
-- portal policy (contacts, deals, deal_stage_history, invoices, payments,
-- campaign_recipients). Returning NULL for a deactivated profile revokes all
-- six at once, in the database, where a held token cannot get around it:
-- `contact_id = NULL` is never true, so the branch simply stops matching.
--
-- Staff are unaffected — the admin and recruiter branches of those policies
-- do not call this function.
--
-- Verified before applying: 16 of 17 player profiles are active, and the only
-- inactive one is the QA guardian fixture created to test migration 223, so
-- no real portal user loses access.
--
-- Idempotent.

CREATE OR REPLACE FUNCTION public.get_player_contact_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT COALESCE(contact_id, guardian_for_contact_id)
  FROM public.profiles
  WHERE id = auth.uid()
    AND is_active IS DISTINCT FROM false
$function$;
