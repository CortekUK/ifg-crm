-- Make the QA-54 policies fast enough to actually use.
--
-- Migration 213 scoped invoices and payments with
--   contact_id IN (SELECT id FROM contacts WHERE owner_id = auth.uid())
-- which is correct and unusably slow: the subquery reads `contacts`, which
-- has its own RLS policy, so the planner re-evaluates that policy against
-- 179k rows for every candidate row. dashboard_overview() aggregates invoices
-- several times, and as a recruiter it stopped returning at all —
-- "canceling statement due to statement timeout". A correct rule nobody can
-- load is not a working rule.
--
-- Two changes, both standard Postgres/Supabase practice:
--
--  1. Ownership checks move into SECURITY DEFINER helpers. They bypass the
--     nested RLS on `contacts`/`deals`, turning each check into a single
--     indexed lookup (idx_contacts_owner, idx_deals_owner already exist).
--
--  2. auth.uid() and the role helpers are wrapped as scalar subqueries, so
--     the planner hoists them into an InitPlan and evaluates them once per
--     query instead of once per row. The existing contacts policy already
--     does this — these now match it.
--
-- The access rules themselves are unchanged from 213. This is purely how they
-- are evaluated.

CREATE OR REPLACE FUNCTION public.owns_contact(p_contact_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_contact_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM contacts c
       WHERE c.id = p_contact_id AND c.owner_id = auth.uid()
     )
$$;

CREATE OR REPLACE FUNCTION public.owns_deal(p_deal_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_deal_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM deals d
       WHERE d.id = p_deal_id AND d.deal_owner_id = auth.uid()
     )
$$;

COMMENT ON FUNCTION public.owns_contact(UUID) IS
  'Does the caller own this contact? SECURITY DEFINER so RLS policies can use '
  'it without re-running the contacts policy per row.';

COMMENT ON FUNCTION public.owns_deal(UUID) IS
  'Does the caller own this deal? SECURITY DEFINER, for the same reason as '
  'owns_contact.';

-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS invoices_select ON invoices;
CREATE POLICY invoices_select ON invoices
  FOR SELECT USING (
    (SELECT is_admin())
    OR ((SELECT get_user_role()) = 'player' AND contact_id = (SELECT get_player_contact_id()))
    OR (
      (SELECT get_user_role()) = 'recruiter'
      AND (owns_contact(contact_id) OR owns_deal(deal_id))
    )
  );

DROP POLICY IF EXISTS payments_select ON payments;
CREATE POLICY payments_select ON payments
  FOR SELECT USING (
    (SELECT is_admin())
    OR ((SELECT get_user_role()) = 'player' AND contact_id = (SELECT get_player_contact_id()))
    OR (
      (SELECT get_user_role()) = 'recruiter'
      AND (
        owns_contact(contact_id)
        OR EXISTS (
          SELECT 1 FROM invoices i
          WHERE i.id = payments.invoice_id AND owns_deal(i.deal_id)
        )
      )
    )
  );

DROP POLICY IF EXISTS "Allow authenticated read" ON profiles;
CREATE POLICY "Allow authenticated read" ON profiles
  FOR SELECT USING (
    id = (SELECT auth.uid())
    OR (SELECT is_admin())
    OR ((SELECT is_staff()) AND role IN ('admin', 'super_admin', 'recruiter'))
  );

DROP POLICY IF EXISTS "Authenticated users can read settings" ON crm_settings;
CREATE POLICY "Authenticated users can read settings" ON crm_settings
  FOR SELECT USING ((SELECT is_admin()));

DROP POLICY IF EXISTS campaigns_select ON campaigns;
CREATE POLICY campaigns_select ON campaigns
  FOR SELECT USING ((SELECT is_admin()));

DROP POLICY IF EXISTS email_templates_select ON email_templates;
CREATE POLICY email_templates_select ON email_templates
  FOR SELECT USING ((SELECT is_admin()));

DROP POLICY IF EXISTS automations_select ON automations;
CREATE POLICY automations_select ON automations
  FOR SELECT USING ((SELECT is_staff()));
