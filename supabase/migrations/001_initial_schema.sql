-- Enable required extensions (pgcrypto for gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'recruiter' CHECK (role IN ('super_admin', 'admin', 'recruiter')),
  calendly_url TEXT,
  avatar_url TEXT,
  sport TEXT NOT NULL DEFAULT 'football' CHECK (sport IN ('football', 'basketball')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. CONTACTS (players/leads - ~150k records)
-- ============================================
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  graduation_year INTEGER,
  gender TEXT CHECK (gender IN ('male', 'female')),
  country TEXT,
  state TEXT,
  city TEXT,
  club_name TEXT,
  position TEXT,
  gpa DECIMAL(3,2),
  parent_name TEXT,
  parent_email TEXT,
  parent_phone TEXT,
  source TEXT CHECK (source IN ('website_form', 'sms_reply', 'email_reply', 'manual', 'csv_import')),
  source_detail TEXT,
  sport TEXT NOT NULL DEFAULT 'football' CHECK (sport IN ('football', 'basketball')),
  subscription_status TEXT NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'unsubscribed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ
);

CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_phone ON contacts(phone);
CREATE INDEX idx_contacts_graduation_year ON contacts(graduation_year);
CREATE INDEX idx_contacts_sport ON contacts(sport);
CREATE INDEX idx_contacts_subscription_status ON contacts(subscription_status);
CREATE INDEX idx_contacts_last_activity ON contacts(last_activity_at DESC);
CREATE INDEX idx_contacts_created ON contacts(created_at DESC);

-- ============================================
-- 3. LISTS (contact segmentation groups)
-- ============================================
CREATE TABLE lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sport TEXT NOT NULL DEFAULT 'football' CHECK (sport IN ('football', 'basketball')),
  is_dynamic BOOLEAN NOT NULL DEFAULT false,
  rules JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 4. CONTACT_LISTS (junction - many-to-many)
-- ============================================
CREATE TABLE contact_lists (
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (contact_id, list_id)
);

CREATE INDEX idx_contact_lists_list ON contact_lists(list_id);

-- ============================================
-- 5. TAGS
-- ============================================
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  category TEXT CHECK (category IN ('tournament', 'skill', 'priority', 'other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 6. CONTACT_TAGS (junction)
-- ============================================
CREATE TABLE contact_tags (
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (contact_id, tag_id)
);

CREATE INDEX idx_contact_tags_tag ON contact_tags(tag_id);

-- ============================================
-- 7. PROGRAMMES
-- ============================================
CREATE TABLE programmes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('university', 'gap_year', 'residency', 'camp', 'trial')),
  sport TEXT NOT NULL DEFAULT 'football' CHECK (sport IN ('football', 'basketball')),
  description TEXT,
  default_deposit_amount DECIMAL(10,2),
  default_total_cost DECIMAL(10,2),
  university_partner TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 8. PIPELINES
-- ============================================
CREATE TABLE pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  programme_id UUID REFERENCES programmes(id) ON DELETE SET NULL,
  sport TEXT NOT NULL DEFAULT 'football' CHECK (sport IN ('football', 'basketball')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 9. PIPELINE_STAGES
-- ============================================
CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stage_type TEXT NOT NULL CHECK (stage_type IN ('lead', 'contact', 'meeting', 'follow_up', 'documents', 'applied', 'offer', 'payment', 'completed', 'lost', 'dormant')),
  triggers_automation BOOLEAN NOT NULL DEFAULT false,
  automation_id UUID,
  display_order INTEGER NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pipeline_id, display_order)
);

CREATE INDEX idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id);

-- ============================================
-- 10. DEALS
-- ============================================
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  current_stage_id UUID NOT NULL REFERENCES pipeline_stages(id),
  deal_owner_id UUID NOT NULL REFERENCES profiles(id),
  deal_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  notes TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  won_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  lost_reason TEXT,
  last_activity_at TIMESTAMPTZ,
  UNIQUE(contact_id, pipeline_id)
);

CREATE INDEX idx_deals_contact ON deals(contact_id);
CREATE INDEX idx_deals_pipeline ON deals(pipeline_id);
CREATE INDEX idx_deals_stage ON deals(current_stage_id);
CREATE INDEX idx_deals_owner ON deals(deal_owner_id);
CREATE INDEX idx_deals_created ON deals(created_at DESC);

-- ============================================
-- 11. DEAL_ACTIVITIES
-- ============================================
CREATE TABLE deal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('stage_changed', 'note_added', 'email_sent', 'email_opened', 'sms_sent', 'sms_received', 'call_scheduled', 'call_completed', 'document_uploaded', 'invoice_sent', 'payment_received', 'deal_created', 'owner_changed')),
  description TEXT,
  old_value JSONB,
  new_value JSONB,
  performed_by_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deal_activities_deal ON deal_activities(deal_id);
CREATE INDEX idx_deal_activities_type ON deal_activities(activity_type);
CREATE INDEX idx_deal_activities_created ON deal_activities(created_at DESC);

-- ============================================
-- 12. EMAIL_TEMPLATES
-- ============================================
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_json JSONB,
  category TEXT NOT NULL CHECK (category IN ('automation', 'campaign', 'transactional')),
  from_name_type TEXT NOT NULL DEFAULT 'deal_owner' CHECK (from_name_type IN ('deal_owner', 'fixed')),
  fixed_from_name TEXT,
  fixed_from_email TEXT,
  attachments JSONB DEFAULT '[]',
  created_by_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 13. AUTOMATIONS
-- ============================================
CREATE TABLE automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL,
  trigger_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  stop_on_stage_ids UUID[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key from pipeline_stages to automations
ALTER TABLE pipeline_stages 
ADD CONSTRAINT fk_pipeline_stages_automation 
FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE SET NULL;

-- ============================================
-- 14. AUTOMATION_STEPS
-- ============================================
CREATE TABLE automation_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('send_email', 'wait', 'send_sms', 'move_to_stage')),
  delay_days INTEGER NOT NULL DEFAULT 0,
  delay_hours INTEGER NOT NULL DEFAULT 0,
  email_template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  sms_content TEXT,
  target_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  conditions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(automation_id, step_order)
);

CREATE INDEX idx_automation_steps_automation ON automation_steps(automation_id);

-- ============================================
-- 15. AUTOMATION_ENROLLMENTS
-- ============================================
CREATE TABLE automation_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  current_step_id UUID REFERENCES automation_steps(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'stopped', 'paused')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_step_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  stopped_reason TEXT,
  UNIQUE(automation_id, deal_id)
);

CREATE INDEX idx_automation_enrollments_automation ON automation_enrollments(automation_id);
CREATE INDEX idx_automation_enrollments_deal ON automation_enrollments(deal_id);
CREATE INDEX idx_automation_enrollments_status ON automation_enrollments(status);
CREATE INDEX idx_automation_enrollments_next_step ON automation_enrollments(next_step_at);

-- ============================================
-- 16. AUTOMATION_LOGS
-- ============================================
CREATE TABLE automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES automation_enrollments(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES automation_steps(id),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_message TEXT,
  email_message_id TEXT
);

CREATE INDEX idx_automation_logs_enrollment ON automation_logs(enrollment_id);
CREATE INDEX idx_automation_logs_deal ON automation_logs(deal_id);

-- ============================================
-- 17. CAMPAIGNS
-- ============================================
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  email_template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  sms_content TEXT,
  from_user_id UUID NOT NULL REFERENCES profiles(id),
  thumbnail_url TEXT,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_by_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 18. CAMPAIGN_LISTS
-- ============================================
CREATE TABLE campaign_lists (
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, list_id)
);

-- ============================================
-- 19. CAMPAIGN_RECIPIENTS
-- ============================================
CREATE TABLE campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  error_message TEXT,
  resend_message_id TEXT,
  UNIQUE(campaign_id, contact_id)
);

CREATE INDEX idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_contact ON campaign_recipients(contact_id);
CREATE INDEX idx_campaign_recipients_status ON campaign_recipients(status);

-- ============================================
-- 20. SMS_MESSAGES
-- ============================================
CREATE TABLE sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content TEXT NOT NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  click_send_number TEXT,
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL,
  ai_intent TEXT CHECK (ai_intent IN ('positive', 'negative', 'neutral', 'unknown')),
  ai_intent_confidence DECIMAL(3,2),
  match_status TEXT NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('auto_matched', 'manually_matched', 'unmatched', 'spam')),
  matched_by_id UUID REFERENCES profiles(id),
  matched_at TIMESTAMPTZ,
  follow_up_status TEXT NOT NULL DEFAULT 'open' CHECK (follow_up_status IN ('open', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sms_messages_contact ON sms_messages(contact_id);
CREATE INDEX idx_sms_messages_phone ON sms_messages(phone_number);
CREATE INDEX idx_sms_messages_match_status ON sms_messages(match_status);
CREATE INDEX idx_sms_messages_follow_up ON sms_messages(follow_up_status);
CREATE INDEX idx_sms_messages_created ON sms_messages(created_at DESC);

-- ============================================
-- 21. EMAIL_REPLIES
-- ============================================
CREATE TABLE email_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  from_email TEXT NOT NULL,
  from_name TEXT,
  subject TEXT,
  body_preview TEXT,
  body_full TEXT,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  ai_intent TEXT CHECK (ai_intent IN ('positive', 'negative', 'neutral', 'unknown')),
  match_status TEXT NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('auto_matched', 'manually_matched', 'unmatched', 'spam')),
  matched_by_id UUID REFERENCES profiles(id),
  matched_at TIMESTAMPTZ,
  follow_up_status TEXT NOT NULL DEFAULT 'open' CHECK (follow_up_status IN ('open', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_replies_contact ON email_replies(contact_id);
CREATE INDEX idx_email_replies_from ON email_replies(from_email);
CREATE INDEX idx_email_replies_match_status ON email_replies(match_status);
CREATE INDEX idx_email_replies_created ON email_replies(created_at DESC);

-- ============================================
-- 22. INVOICES
-- ============================================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'installment', 'full_payment', 'meal_plan', 'trip', 'other')),
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled')),
  due_date DATE NOT NULL,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  xero_invoice_id TEXT,
  payment_method TEXT CHECK (payment_method IN ('stripe', 'bank_transfer', 'website', 'manual')),
  notes TEXT,
  created_by_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_contact ON invoices(contact_id);
CREATE INDEX idx_invoices_deal ON invoices(deal_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);

-- ============================================
-- 23. PAYMENTS
-- ============================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_date TIMESTAMPTZ NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('stripe', 'bank_transfer', 'website', 'cash', 'other')),
  stripe_payment_id TEXT,
  reference TEXT,
  notes TEXT,
  recorded_by_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_contact ON payments(contact_id);

-- ============================================
-- 24. PAYMENT_PLANS
-- ============================================
CREATE TABLE payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  programme_id UUID REFERENCES programmes(id) ON DELETE SET NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  deposit_amount DECIMAL(10,2) NOT NULL,
  installment_count INTEGER NOT NULL,
  installment_frequency TEXT NOT NULL CHECK (installment_frequency IN ('weekly', 'monthly', 'quarterly')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 25. CONTACT_PAYMENT_PLANS
-- ============================================
CREATE TABLE contact_payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  payment_plan_id UUID NOT NULL REFERENCES payment_plans(id),
  start_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 26. PORTAL_USERS
-- ============================================
CREATE TABLE portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  activation_token TEXT,
  activation_sent_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 27. DOCUMENTS
-- ============================================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('registration_form', 'terms_conditions', 'consent_form', 'code_of_conduct', 'passport_copy', 'other')),
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by_id UUID REFERENCES profiles(id),
  notes TEXT
);

CREATE INDEX idx_documents_contact ON documents(contact_id);

-- ============================================
-- 28. PORTAL_NOTIFICATIONS
-- ============================================
CREATE TABLE portal_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('payment_reminder', 'event', 'document_request', 'general')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  link_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_portal_notifications_contact ON portal_notifications(contact_id);
CREATE INDEX idx_portal_notifications_unread ON portal_notifications(contact_id) WHERE NOT is_read;

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lists_updated_at BEFORE UPDATE ON lists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_programmes_updated_at BEFORE UPDATE ON programmes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pipelines_updated_at BEFORE UPDATE ON pipelines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pipeline_stages_updated_at BEFORE UPDATE ON pipeline_stages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_automations_updated_at BEFORE UPDATE ON automations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INVOICE NUMBER GENERATION
-- ============================================
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'IFG-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(nextval('invoice_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invoice_number BEFORE INSERT ON invoices FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_notifications ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (allow authenticated users full access for now)
-- These should be refined for production

CREATE POLICY "Allow authenticated read" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON profiles FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated full access" ON contacts FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON lists FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON contact_lists FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON tags FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON contact_tags FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON programmes FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON pipelines FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON pipeline_stages FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON deals FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON deal_activities FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON email_templates FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON automations FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON automation_steps FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON automation_enrollments FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON automation_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON campaigns FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON campaign_lists FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON campaign_recipients FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON sms_messages FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON email_replies FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON invoices FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON payments FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON payment_plans FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON contact_payment_plans FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON portal_users FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON documents FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access" ON portal_notifications FOR ALL TO authenticated USING (true);

-- ============================================
-- AUTO-CREATE PROFILE ON USER SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
