-- Migration: scope every contact-linked table to the recruiter's contact
-- visibility, and lock down global config tables to admin-only writes.
--
-- Pattern for contact-linked tables (invoices, payments, etc.):
--   SELECT / INSERT / UPDATE / DELETE allowed if:
--     - admin / super_admin, OR
--     - the row's contact_id is visible per the contacts SELECT policy
--       (PostgreSQL re-checks the contacts policy when we run the IN subquery,
--        which means recruiter scope cascades automatically)
--   Rows with NULL contact_id (e.g. unmatched email_replies) → admin-only.
--
-- Pattern for global config (lists, tags, templates, programmes, campaigns,
-- automations, automation_steps, payment_plans):
--   SELECT allowed for any authenticated user (recruiters need to read these
--   to render filters / pickers).
--   INSERT / UPDATE / DELETE → admin / super_admin only.
--
-- Service-role calls (webhooks, edge functions, cron) bypass RLS, so the
-- inbound pipelines (form ingestion, Resend webhook, automations runner) are
-- unaffected.

-- ------------------------------------------------------------------
-- Helper: is the current user admin/super_admin?
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT public.get_user_role() IN ('admin', 'super_admin')
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================
-- CONTACT-LINKED TABLES — visibility cascades from contacts RLS
-- ============================================================

-- INVOICES
DROP POLICY IF EXISTS "Allow authenticated full access" ON invoices;
DROP POLICY IF EXISTS "Players can view own invoices" ON invoices;

CREATE POLICY "invoices_select" ON invoices FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (contact_id IS NOT NULL AND contact_id IN (SELECT id FROM contacts))
    OR (public.get_user_role() = 'player' AND contact_id = public.get_player_contact_id())
  );
CREATE POLICY "invoices_insert" ON invoices FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR (contact_id IS NOT NULL AND contact_id IN (SELECT id FROM contacts)));
CREATE POLICY "invoices_update" ON invoices FOR UPDATE TO authenticated
  USING (public.is_admin() OR (contact_id IS NOT NULL AND contact_id IN (SELECT id FROM contacts)))
  WITH CHECK (public.is_admin() OR (contact_id IS NOT NULL AND contact_id IN (SELECT id FROM contacts)));
CREATE POLICY "invoices_delete" ON invoices FOR DELETE TO authenticated
  USING (public.is_admin());

-- PAYMENTS
DROP POLICY IF EXISTS "Allow authenticated full access" ON payments;
DROP POLICY IF EXISTS "Players can view own payments" ON payments;

CREATE POLICY "payments_select" ON payments FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (contact_id IS NOT NULL AND contact_id IN (SELECT id FROM contacts))
    OR (public.get_user_role() = 'player' AND contact_id = public.get_player_contact_id())
  );
CREATE POLICY "payments_insert" ON payments FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR (contact_id IS NOT NULL AND contact_id IN (SELECT id FROM contacts)));
CREATE POLICY "payments_update" ON payments FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE POLICY "payments_delete" ON payments FOR DELETE TO authenticated
  USING (public.is_admin());

-- CONTACT_PAYMENT_PLANS
DROP POLICY IF EXISTS "Allow authenticated full access" ON contact_payment_plans;

CREATE POLICY "contact_payment_plans_select" ON contact_payment_plans FOR SELECT TO authenticated
  USING (public.is_admin() OR contact_id IN (SELECT id FROM contacts));
CREATE POLICY "contact_payment_plans_insert" ON contact_payment_plans FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR contact_id IN (SELECT id FROM contacts));
CREATE POLICY "contact_payment_plans_update" ON contact_payment_plans FOR UPDATE TO authenticated
  USING (public.is_admin() OR contact_id IN (SELECT id FROM contacts))
  WITH CHECK (public.is_admin() OR contact_id IN (SELECT id FROM contacts));
CREATE POLICY "contact_payment_plans_delete" ON contact_payment_plans FOR DELETE TO authenticated
  USING (public.is_admin());

-- EMAIL_REPLIES (contact_id nullable; unmatched replies → admin only)
DROP POLICY IF EXISTS "Allow authenticated full access" ON email_replies;

CREATE POLICY "email_replies_select" ON email_replies FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (contact_id IS NOT NULL AND contact_id IN (SELECT id FROM contacts))
  );
CREATE POLICY "email_replies_insert" ON email_replies FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR (contact_id IS NOT NULL AND contact_id IN (SELECT id FROM contacts)));
CREATE POLICY "email_replies_update" ON email_replies FOR UPDATE TO authenticated
  USING (public.is_admin() OR (contact_id IS NOT NULL AND contact_id IN (SELECT id FROM contacts)))
  WITH CHECK (public.is_admin() OR (contact_id IS NOT NULL AND contact_id IN (SELECT id FROM contacts)));
CREATE POLICY "email_replies_delete" ON email_replies FOR DELETE TO authenticated
  USING (public.is_admin());

-- SMS_MESSAGES (contact_id nullable)
DROP POLICY IF EXISTS "Allow authenticated full access" ON sms_messages;

CREATE POLICY "sms_messages_select" ON sms_messages FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (contact_id IS NOT NULL AND contact_id IN (SELECT id FROM contacts))
  );
CREATE POLICY "sms_messages_insert" ON sms_messages FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR (contact_id IS NOT NULL AND contact_id IN (SELECT id FROM contacts)));
CREATE POLICY "sms_messages_update" ON sms_messages FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE POLICY "sms_messages_delete" ON sms_messages FOR DELETE TO authenticated
  USING (public.is_admin());

-- CONTACT_LISTS (junction)
DROP POLICY IF EXISTS "Allow authenticated full access" ON contact_lists;

CREATE POLICY "contact_lists_select" ON contact_lists FOR SELECT TO authenticated
  USING (public.is_admin() OR contact_id IN (SELECT id FROM contacts));
CREATE POLICY "contact_lists_insert" ON contact_lists FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR contact_id IN (SELECT id FROM contacts));
CREATE POLICY "contact_lists_update" ON contact_lists FOR UPDATE TO authenticated
  USING (public.is_admin() OR contact_id IN (SELECT id FROM contacts))
  WITH CHECK (public.is_admin() OR contact_id IN (SELECT id FROM contacts));
CREATE POLICY "contact_lists_delete" ON contact_lists FOR DELETE TO authenticated
  USING (public.is_admin() OR contact_id IN (SELECT id FROM contacts));

-- CONTACT_TAGS (junction)
DROP POLICY IF EXISTS "Allow authenticated full access" ON contact_tags;

CREATE POLICY "contact_tags_select" ON contact_tags FOR SELECT TO authenticated
  USING (public.is_admin() OR contact_id IN (SELECT id FROM contacts));
CREATE POLICY "contact_tags_insert" ON contact_tags FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR contact_id IN (SELECT id FROM contacts));
CREATE POLICY "contact_tags_update" ON contact_tags FOR UPDATE TO authenticated
  USING (public.is_admin() OR contact_id IN (SELECT id FROM contacts))
  WITH CHECK (public.is_admin() OR contact_id IN (SELECT id FROM contacts));
CREATE POLICY "contact_tags_delete" ON contact_tags FOR DELETE TO authenticated
  USING (public.is_admin() OR contact_id IN (SELECT id FROM contacts));

-- CAMPAIGN_RECIPIENTS — recruiter sees recipients only for their contacts
DROP POLICY IF EXISTS "Allow authenticated full access" ON campaign_recipients;
DROP POLICY IF EXISTS "Players can view own campaign recipients" ON campaign_recipients;

CREATE POLICY "campaign_recipients_select" ON campaign_recipients FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR contact_id IN (SELECT id FROM contacts)
    OR (public.get_user_role() = 'player' AND contact_id = public.get_player_contact_id())
  );
CREATE POLICY "campaign_recipients_insert" ON campaign_recipients FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR contact_id IN (SELECT id FROM contacts));
CREATE POLICY "campaign_recipients_update" ON campaign_recipients FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE POLICY "campaign_recipients_delete" ON campaign_recipients FOR DELETE TO authenticated
  USING (public.is_admin());

-- DOCUMENTS
DROP POLICY IF EXISTS "Allow authenticated full access" ON documents;

CREATE POLICY "documents_select" ON documents FOR SELECT TO authenticated
  USING (public.is_admin() OR contact_id IN (SELECT id FROM contacts));
CREATE POLICY "documents_insert" ON documents FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR contact_id IN (SELECT id FROM contacts));
CREATE POLICY "documents_update" ON documents FOR UPDATE TO authenticated
  USING (public.is_admin() OR contact_id IN (SELECT id FROM contacts))
  WITH CHECK (public.is_admin() OR contact_id IN (SELECT id FROM contacts));
CREATE POLICY "documents_delete" ON documents FOR DELETE TO authenticated
  USING (public.is_admin() OR contact_id IN (SELECT id FROM contacts));

-- CONTACT_NOTES — replace the legacy "Users can view all contact notes"
DROP POLICY IF EXISTS "Users can view all contact notes" ON contact_notes;
DROP POLICY IF EXISTS "Users can insert contact notes" ON contact_notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON contact_notes;

CREATE POLICY "contact_notes_select" ON contact_notes FOR SELECT TO authenticated
  USING (public.is_admin() OR contact_id IN (SELECT id FROM contacts));
CREATE POLICY "contact_notes_insert" ON contact_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR contact_id IN (SELECT id FROM contacts));
CREATE POLICY "contact_notes_update" ON contact_notes FOR UPDATE TO authenticated
  USING (public.is_admin() OR contact_id IN (SELECT id FROM contacts))
  WITH CHECK (public.is_admin() OR contact_id IN (SELECT id FROM contacts));
CREATE POLICY "contact_notes_delete" ON contact_notes FOR DELETE TO authenticated
  USING (public.is_admin() OR contact_id IN (SELECT id FROM contacts));

-- ============================================================
-- GLOBAL CONFIG TABLES — read for any authenticated; admin-only writes
-- ============================================================

-- LISTS
DROP POLICY IF EXISTS "Allow authenticated full access" ON lists;
CREATE POLICY "lists_select" ON lists FOR SELECT TO authenticated USING (true);
CREATE POLICY "lists_insert" ON lists FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "lists_update" ON lists FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "lists_delete" ON lists FOR DELETE TO authenticated USING (public.is_admin());

-- TAGS
DROP POLICY IF EXISTS "Allow authenticated full access" ON tags;
CREATE POLICY "tags_select" ON tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "tags_insert" ON tags FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "tags_update" ON tags FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "tags_delete" ON tags FOR DELETE TO authenticated USING (public.is_admin());

-- EMAIL_TEMPLATES
DROP POLICY IF EXISTS "Allow authenticated full access" ON email_templates;
CREATE POLICY "email_templates_select" ON email_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "email_templates_insert" ON email_templates FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "email_templates_update" ON email_templates FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "email_templates_delete" ON email_templates FOR DELETE TO authenticated USING (public.is_admin());

-- PROGRAMMES
DROP POLICY IF EXISTS "Allow authenticated full access" ON programmes;
CREATE POLICY "programmes_select" ON programmes FOR SELECT TO authenticated USING (true);
CREATE POLICY "programmes_insert" ON programmes FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "programmes_update" ON programmes FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "programmes_delete" ON programmes FOR DELETE TO authenticated USING (public.is_admin());

-- CAMPAIGNS
DROP POLICY IF EXISTS "Allow authenticated full access" ON campaigns;
CREATE POLICY "campaigns_select" ON campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "campaigns_insert" ON campaigns FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "campaigns_update" ON campaigns FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "campaigns_delete" ON campaigns FOR DELETE TO authenticated USING (public.is_admin());

-- CAMPAIGN_LISTS (junction — global)
DROP POLICY IF EXISTS "Allow authenticated full access" ON campaign_lists;
CREATE POLICY "campaign_lists_select" ON campaign_lists FOR SELECT TO authenticated USING (true);
CREATE POLICY "campaign_lists_insert" ON campaign_lists FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "campaign_lists_update" ON campaign_lists FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "campaign_lists_delete" ON campaign_lists FOR DELETE TO authenticated USING (public.is_admin());

-- AUTOMATIONS
DROP POLICY IF EXISTS "Allow authenticated full access" ON automations;
CREATE POLICY "automations_select" ON automations FOR SELECT TO authenticated USING (true);
CREATE POLICY "automations_insert" ON automations FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "automations_update" ON automations FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "automations_delete" ON automations FOR DELETE TO authenticated USING (public.is_admin());

-- AUTOMATION_STEPS
DROP POLICY IF EXISTS "Allow authenticated full access" ON automation_steps;
CREATE POLICY "automation_steps_select" ON automation_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "automation_steps_insert" ON automation_steps FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "automation_steps_update" ON automation_steps FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "automation_steps_delete" ON automation_steps FOR DELETE TO authenticated USING (public.is_admin());

-- PAYMENT_PLANS (template plans, not per-contact)
DROP POLICY IF EXISTS "Allow authenticated full access" ON payment_plans;
CREATE POLICY "payment_plans_select" ON payment_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "payment_plans_insert" ON payment_plans FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "payment_plans_update" ON payment_plans FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "payment_plans_delete" ON payment_plans FOR DELETE TO authenticated USING (public.is_admin());
