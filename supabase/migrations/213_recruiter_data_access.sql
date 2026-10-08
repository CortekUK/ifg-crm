-- QA-54 Bug 1 (Critical): the pages were blocked, the data was not.
--
-- Every admin page correctly sends a recruiter to /unauthorized, and the admin
-- APIs refuse them. But a recruiter's own logged-in session could read straight
-- from the database — 39 of 39 invoices, 15 of 15 payments, 29 of 29 profiles,
-- 30 automations, 3 campaigns, 28 email templates and every CRM setting. Any
-- recruiter with browser developer tools had the lot.
--
-- Two separate causes:
--
--  1. invoices/payments carried `contact_id IN (SELECT id FROM contacts)`,
--     which reads as "a contact you are allowed to see". Recruiters are allowed
--     to see every contact, so the clause matched every row — it scoped nothing.
--
--  2. automations, campaigns, email_templates and crm_settings were simply
--     `USING (true)`.
--
-- Scoped rather than blanket-blocked, so recruiters keep working: they still
-- see invoices and payments for players THEY own, which is what the contact
-- panel shows them. The full Invoices and Payments pages stay admin-only, as
-- the page rules already say.
--
-- ROLLBACK: the previous definition of each policy is quoted above it.

-- ---------------------------------------------------------------------------
-- invoices — was:
--   is_admin() OR (contact_id IS NOT NULL AND contact_id IN (SELECT id FROM contacts))
--               OR (get_user_role() = 'player' AND contact_id = get_player_contact_id())
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS invoices_select ON invoices;
CREATE POLICY invoices_select ON invoices
  FOR SELECT USING (
    is_admin()
    OR (get_user_role() = 'player' AND contact_id = get_player_contact_id())
    -- A recruiter sees an invoice only for a player they own, or against a
    -- deal they own.
    OR (
      get_user_role() = 'recruiter'
      AND (
        contact_id IN (SELECT id FROM contacts WHERE owner_id = auth.uid())
        OR deal_id IN (SELECT id FROM deals WHERE deal_owner_id = auth.uid())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- payments — same shape as invoices.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS payments_select ON payments;
CREATE POLICY payments_select ON payments
  FOR SELECT USING (
    is_admin()
    OR (get_user_role() = 'player' AND contact_id = get_player_contact_id())
    OR (
      get_user_role() = 'recruiter'
      AND (
        contact_id IN (SELECT id FROM contacts WHERE owner_id = auth.uid())
        OR invoice_id IN (
          SELECT i.id FROM invoices i WHERE i.deal_id IN (
            SELECT d.id FROM deals d WHERE d.deal_owner_id = auth.uid()
          )
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- profiles — was: get_user_role() <> 'player' OR id = auth.uid()
--
-- That gave every recruiter all 29 profiles, including the 22 player portal
-- accounts. Colleagues still need to see each other (deal owner pickers, round
-- robin), so staff keep reading STAFF rows; player accounts become admin-only.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated read" ON profiles;
CREATE POLICY "Allow authenticated read" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR is_admin()
    OR (is_staff() AND role IN ('admin', 'super_admin', 'recruiter'))
  );

-- ---------------------------------------------------------------------------
-- crm_settings — was: true
--
-- Holds the email branding blob, notification preferences and general settings.
-- Nothing on a recruiter screen reads it; the edge functions use the service
-- key, which bypasses RLS.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read settings" ON crm_settings;
CREATE POLICY "Authenticated users can read settings" ON crm_settings
  FOR SELECT USING (is_admin());

-- ---------------------------------------------------------------------------
-- campaigns / email_templates — were: true
--
-- Both screens are admin-only (middleware adminOnlyPaths), so the data follows.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS campaigns_select ON campaigns;
CREATE POLICY campaigns_select ON campaigns
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS email_templates_select ON email_templates;
CREATE POLICY email_templates_select ON email_templates
  FOR SELECT USING (is_admin());

-- ---------------------------------------------------------------------------
-- automations — deliberately still readable by staff.
--
-- Deal creation reads the deal_creation automations for the pipeline and stage
-- a recruiter is dropping a card into, and the pipeline screens show which
-- automations are live. Locking this to admins breaks a recruiter's own work,
-- and the rows carry configuration rather than anyone's personal data. Left as
-- staff-readable on purpose; flagged for Ghulam rather than changed quietly.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS automations_select ON automations;
CREATE POLICY automations_select ON automations
  FOR SELECT USING (is_staff());
