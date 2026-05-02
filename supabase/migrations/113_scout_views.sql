-- ============================================================================
-- Migration 113: Scout AI assistant — curated read-only views
-- ============================================================================
-- Scout is a super_admin-only chat assistant. It uses an LLM with tool calls
-- that read from these v_scout_* views, plus a single execute_readonly_sql
-- escape hatch that is restricted to this view set.
--
-- These views deliberately:
--   * Pre-join the FK lookups Scout would otherwise need to chain.
--   * Exclude every sensitive column (calendly tokens, raw webhook payloads,
--     full-HTML email bodies, password timestamps, etc.). Scout never sees
--     auth.* tables or anything that would let it reconstruct credentials.
--   * Surface a few derived columns (days_overdue, age_days, time_in_stage)
--     so the model can answer common "what's overdue / what's stuck" questions
--     without writing date arithmetic.
--
-- Re-running this migration drops and recreates the views, so it's safe to
-- iterate on shape as the assistant matures.
-- ============================================================================

-- Drop in reverse-dependency order (none of these depend on each other today,
-- but DROP IF EXISTS keeps the migration re-runnable.)
DROP VIEW IF EXISTS public.v_scout_metrics;
DROP VIEW IF EXISTS public.v_scout_calendar;
DROP VIEW IF EXISTS public.v_scout_form_submissions;
DROP VIEW IF EXISTS public.v_scout_communications;
DROP VIEW IF EXISTS public.v_scout_lists;
DROP VIEW IF EXISTS public.v_scout_pipeline_state;
DROP VIEW IF EXISTS public.v_scout_automations;
DROP VIEW IF EXISTS public.v_scout_invoices;
DROP VIEW IF EXISTS public.v_scout_deals;
DROP VIEW IF EXISTS public.v_scout_contacts;
DROP VIEW IF EXISTS public.v_scout_users;

-- ============================================================================
-- v_scout_users: profiles, but trimmed of secrets.
-- ============================================================================
CREATE VIEW public.v_scout_users AS
SELECT
  p.id,
  p.full_name,
  p.email,
  p.phone,
  p.title,
  p.role,
  p.is_active,
  p.sport,
  p.calendly_url,
  p.zoom_url,
  p.contact_id,
  p.guardian_for_contact_id,
  p.password_set_at IS NOT NULL AS portal_activated,
  p.created_at,
  p.updated_at
FROM public.profiles p;

COMMENT ON VIEW public.v_scout_users IS
  'Scout: user profiles without secrets. Role tells us super_admin vs recruiter vs player vs guardian.';

-- ============================================================================
-- v_scout_contacts: contact + guardian + computed counts.
-- ============================================================================
CREATE VIEW public.v_scout_contacts AS
SELECT
  c.id,
  c.first_name,
  c.last_name,
  (c.first_name || ' ' || c.last_name) AS full_name,
  c.email,
  c.phone,
  c.date_of_birth,
  c.graduation_year,
  c.gender,
  c.country,
  c.state,
  c.city,
  c.club_name,
  c.position,
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
  -- Counts so the model can rank "most active" / "no deals" without extra calls
  (SELECT COUNT(*) FROM public.deals d WHERE d.contact_id = c.id) AS deal_count,
  (SELECT COUNT(*) FROM public.invoices i WHERE i.contact_id = c.id) AS invoice_count,
  (SELECT COUNT(*) FROM public.contact_lists cl WHERE cl.contact_id = c.id) AS list_count
FROM public.contacts c
LEFT JOIN public.profiles owner ON owner.id = c.owner_id;

COMMENT ON VIEW public.v_scout_contacts IS
  'Scout: contact rows with guardian info inline + deal/invoice/list counts.';

-- ============================================================================
-- v_scout_deals: deal + contact + stage + pipeline + owner + intent + dates.
-- ============================================================================
CREATE VIEW public.v_scout_deals AS
SELECT
  d.id,
  d.title,
  d.contact_id,
  c.first_name AS contact_first_name,
  c.last_name AS contact_last_name,
  (c.first_name || ' ' || c.last_name) AS contact_name,
  c.email AS contact_email,
  c.phone AS contact_phone,
  d.pipeline_id,
  pl.name AS pipeline_name,
  COALESCE(d.current_stage_id, d.stage_id) AS stage_id,
  ps.name AS stage_name,
  ps.display_order AS stage_order,
  d.deal_owner_id,
  owner.full_name AS deal_owner_name,
  owner.email AS deal_owner_email,
  d.deal_value,
  d.value AS legacy_value,
  d.status,
  d.intent,
  d.win_probability,
  d.source,
  d.notes,
  d.programme_start_date,
  d.interview_date,
  d.arrival_date,
  d.expected_close_date,
  d.forecasted_close_date,
  d.won_at,
  d.lost_at,
  d.lost_reason,
  d.last_activity_at,
  d.stage_entered_at,
  d.created_at,
  d.updated_at,
  -- Days the deal has been sitting in its current stage. Bottleneck signal.
  CASE
    WHEN d.stage_entered_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (NOW() - d.stage_entered_at)) / 86400.0
    ELSE NULL
  END AS days_in_current_stage,
  EXTRACT(EPOCH FROM (NOW() - d.created_at)) / 86400.0 AS age_days
FROM public.deals d
LEFT JOIN public.contacts c ON c.id = d.contact_id
LEFT JOIN public.pipelines pl ON pl.id = d.pipeline_id
LEFT JOIN public.pipeline_stages ps ON ps.id = COALESCE(d.current_stage_id, d.stage_id)
LEFT JOIN public.profiles owner ON owner.id = d.deal_owner_id;

COMMENT ON VIEW public.v_scout_deals IS
  'Scout: deals fully denormalised with pipeline/stage/owner/contact + age signals.';

-- ============================================================================
-- v_scout_invoices: invoice + contact + deal + payment status with overdue calc.
-- ============================================================================
CREATE VIEW public.v_scout_invoices AS
SELECT
  i.id,
  i.invoice_number,
  i.contact_id,
  c.first_name AS contact_first_name,
  c.last_name AS contact_last_name,
  (c.first_name || ' ' || c.last_name) AS contact_name,
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
  -- Days overdue: positive only when the invoice is still unpaid past its due date
  CASE
    WHEN i.paid_at IS NOT NULL THEN 0
    WHEN i.due_date IS NULL THEN NULL
    WHEN i.due_date < CURRENT_DATE THEN (CURRENT_DATE - i.due_date)
    ELSE 0
  END AS days_overdue,
  i.created_by_id,
  creator.full_name AS created_by_name
FROM public.invoices i
LEFT JOIN public.contacts c ON c.id = i.contact_id
LEFT JOIN public.deals d ON d.id = i.deal_id
LEFT JOIN public.pipelines pl ON pl.id = d.pipeline_id
LEFT JOIN public.profiles creator ON creator.id = i.created_by_id;

COMMENT ON VIEW public.v_scout_invoices IS
  'Scout: invoices with contact/deal/pipeline + computed days_overdue.';

-- ============================================================================
-- v_scout_automations: definitions + pipeline + step counts + enrollment stats.
-- ============================================================================
CREATE VIEW public.v_scout_automations AS
SELECT
  a.id,
  a.name,
  a.description,
  a.automation_type,
  a.trigger_type,
  a.is_active,
  a.status,
  a.pipeline_id,
  pl.name AS pipeline_name,
  a.trigger_stage_id,
  ts.name AS trigger_stage_name,
  a.exit_on_reply,
  a.exit_to_stage_id,
  exit_stage.name AS exit_stage_name,
  a.no_reply_stage_id,
  no_reply_stage.name AS no_reply_stage_name,
  a.config,
  (SELECT COUNT(*) FROM public.automation_steps s WHERE s.automation_id = a.id) AS step_count,
  (SELECT COUNT(*) FROM public.automation_enrollments e WHERE e.automation_id = a.id AND e.status = 'active') AS active_enrollments,
  (SELECT COUNT(*) FROM public.automation_enrollments e WHERE e.automation_id = a.id AND e.status = 'completed') AS completed_enrollments,
  (SELECT COUNT(*) FROM public.automation_enrollments e WHERE e.automation_id = a.id) AS total_enrollments,
  (SELECT MAX(e.enrolled_at) FROM public.automation_enrollments e WHERE e.automation_id = a.id) AS last_enrolled_at,
  a.created_at,
  a.updated_at
FROM public.automations a
LEFT JOIN public.pipelines pl ON pl.id = a.pipeline_id
LEFT JOIN public.pipeline_stages ts ON ts.id = a.trigger_stage_id
LEFT JOIN public.pipeline_stages exit_stage ON exit_stage.id = a.exit_to_stage_id
LEFT JOIN public.pipeline_stages no_reply_stage ON no_reply_stage.id = a.no_reply_stage_id;

COMMENT ON VIEW public.v_scout_automations IS
  'Scout: automation definitions with pipeline/stage names + live enrollment counts.';

-- ============================================================================
-- v_scout_pipeline_state: per-stage deal counts to spot bottlenecks at a glance.
-- ============================================================================
CREATE VIEW public.v_scout_pipeline_state AS
SELECT
  pl.id AS pipeline_id,
  pl.name AS pipeline_name,
  pl.is_active AS pipeline_active,
  ps.id AS stage_id,
  ps.name AS stage_name,
  ps.display_order AS stage_order,
  ps.color AS stage_color,
  ps.stage_type,
  COUNT(d.id) AS deal_count,
  COUNT(d.id) FILTER (WHERE d.intent = 'positive') AS positive_intent_count,
  COUNT(d.id) FILTER (WHERE d.intent = 'negative') AS negative_intent_count,
  AVG(EXTRACT(EPOCH FROM (NOW() - d.stage_entered_at)) / 86400.0)
    FILTER (WHERE d.stage_entered_at IS NOT NULL) AS avg_days_in_stage,
  MAX(EXTRACT(EPOCH FROM (NOW() - d.stage_entered_at)) / 86400.0)
    FILTER (WHERE d.stage_entered_at IS NOT NULL) AS max_days_in_stage
FROM public.pipelines pl
LEFT JOIN public.pipeline_stages ps ON ps.pipeline_id = pl.id
LEFT JOIN public.deals d ON COALESCE(d.current_stage_id, d.stage_id) = ps.id
GROUP BY pl.id, pl.name, pl.is_active, ps.id, ps.name, ps.display_order, ps.color, ps.stage_type;

COMMENT ON VIEW public.v_scout_pipeline_state IS
  'Scout: deal counts and time-in-stage stats per pipeline stage.';

-- ============================================================================
-- v_scout_lists: list definitions + member counts.
-- ============================================================================
CREATE VIEW public.v_scout_lists AS
SELECT
  l.id,
  l.name,
  l.description,
  l.sport,
  l.is_dynamic,
  l.rules,
  (SELECT COUNT(*) FROM public.contact_lists cl WHERE cl.list_id = l.id) AS member_count,
  l.created_at,
  l.updated_at
FROM public.lists l;

COMMENT ON VIEW public.v_scout_lists IS
  'Scout: lists with their live member counts.';

-- ============================================================================
-- v_scout_communications: unified inbound/outbound email + SMS for a contact.
-- ============================================================================
-- Excludes raw_payload + html_body (large, sensitive). The body_preview /
-- short body field is enough for "what did X reply" type questions.
CREATE VIEW public.v_scout_communications AS
SELECT
  'email_send'::text AS channel,
  es.id::text AS id,
  es.recipient_contact_id AS contact_id,
  es.recipient_email AS counterpart,
  es.subject,
  NULL::text AS body_preview,
  es.status,
  NULL::text AS intent,
  es.campaign_id,
  NULL::uuid AS deal_id,
  NULL::uuid AS pipeline_id,
  es.sent_at AS occurred_at,
  es.created_at
FROM public.email_sends es
UNION ALL
SELECT
  'email_reply'::text AS channel,
  er.id::text AS id,
  er.contact_id,
  er.from_email AS counterpart,
  er.subject,
  er.body_preview,
  er.status,
  er.ai_intent AS intent,
  er.campaign_id,
  er.deal_id,
  er.pipeline_id,
  er.received_at AS occurred_at,
  er.created_at
FROM public.email_replies er
UNION ALL
SELECT
  'sms'::text AS channel,
  sr.id::text AS id,
  sr.contact_id,
  sr.from_number AS counterpart,
  NULL::text AS subject,
  sr.body AS body_preview,
  sr.status,
  NULL::text AS intent,
  NULL::uuid AS campaign_id,
  sr.deal_id,
  NULL::uuid AS pipeline_id,
  sr.received_at AS occurred_at,
  sr.created_at
FROM public.sms_replies sr;

COMMENT ON VIEW public.v_scout_communications IS
  'Scout: unified email/SMS communications timeline (no raw payloads or HTML).';

-- ============================================================================
-- v_scout_form_submissions: form submissions with contact + deal outcome.
-- ============================================================================
CREATE VIEW public.v_scout_form_submissions AS
SELECT
  fs.id,
  fs.form_id,
  fs.form_source,
  fs.status,
  fs.error_message,
  fs.contact_id,
  c.first_name AS contact_first_name,
  c.last_name AS contact_last_name,
  c.email AS contact_email,
  fs.deal_id,
  d.title AS deal_title,
  d.pipeline_id,
  pl.name AS pipeline_name,
  fs.automation_id,
  a.name AS automation_name,
  fs.assigned_user_id,
  u.full_name AS assigned_user_name,
  fs.created_at
FROM public.form_submissions fs
LEFT JOIN public.contacts c ON c.id = fs.contact_id
LEFT JOIN public.deals d ON d.id = fs.deal_id
LEFT JOIN public.pipelines pl ON pl.id = d.pipeline_id
LEFT JOIN public.automations a ON a.id = fs.automation_id
LEFT JOIN public.profiles u ON u.id = fs.assigned_user_id;

COMMENT ON VIEW public.v_scout_form_submissions IS
  'Scout: form_submissions with linked contact/deal/automation/assignee.';

-- ============================================================================
-- v_scout_calendar: calendly events with contact + user names.
-- ============================================================================
CREATE VIEW public.v_scout_calendar AS
SELECT
  ce.id,
  ce.event_name,
  ce.event_type,
  ce.contact_id,
  c.first_name AS contact_first_name,
  c.last_name AS contact_last_name,
  c.email AS contact_email,
  ce.user_id,
  u.full_name AS user_name,
  u.email AS user_email,
  ce.deal_id,
  d.title AS deal_title,
  ce.start_time,
  ce.end_time,
  ce.location,
  ce.join_url,
  ce.status,
  ce.created_at,
  CASE
    WHEN ce.start_time > NOW() THEN 'upcoming'
    WHEN ce.end_time < NOW() THEN 'past'
    ELSE 'in_progress'
  END AS time_state
FROM public.calendly_events ce
LEFT JOIN public.contacts c ON c.id = ce.contact_id
LEFT JOIN public.profiles u ON u.id = ce.user_id
LEFT JOIN public.deals d ON d.id = ce.deal_id;

COMMENT ON VIEW public.v_scout_calendar IS
  'Scout: scheduled meetings with contact + recruiter + time_state classification.';

-- ============================================================================
-- v_scout_metrics: high-level platform counts in a single row.
-- One pass so Scout can answer "how many X" questions without a custom query.
-- ============================================================================
CREATE VIEW public.v_scout_metrics AS
SELECT
  (SELECT COUNT(*) FROM public.contacts) AS total_contacts,
  (SELECT COUNT(*) FROM public.contacts WHERE created_at > NOW() - INTERVAL '7 days') AS contacts_last_7d,
  (SELECT COUNT(*) FROM public.contacts WHERE created_at > NOW() - INTERVAL '30 days') AS contacts_last_30d,
  (SELECT COUNT(*) FROM public.deals) AS total_deals,
  (SELECT COUNT(*) FROM public.deals WHERE status = 'won') AS deals_won,
  (SELECT COUNT(*) FROM public.deals WHERE status = 'lost') AS deals_lost,
  (SELECT COUNT(*) FROM public.deals WHERE created_at > NOW() - INTERVAL '7 days') AS deals_last_7d,
  (SELECT COUNT(*) FROM public.invoices) AS total_invoices,
  (SELECT COUNT(*) FROM public.invoices WHERE status = 'paid') AS invoices_paid,
  (SELECT COUNT(*) FROM public.invoices WHERE status IN ('sent','overdue') AND paid_at IS NULL) AS invoices_unpaid,
  (SELECT COALESCE(SUM(amount), 0) FROM public.invoices WHERE status = 'paid') AS revenue_paid,
  (SELECT COALESCE(SUM(amount), 0) FROM public.invoices WHERE paid_at IS NULL) AS revenue_outstanding,
  (SELECT COUNT(*) FROM public.automations WHERE is_active = TRUE) AS active_automations,
  (SELECT COUNT(*) FROM public.automation_enrollments WHERE status = 'active') AS active_enrollments,
  (SELECT COUNT(*) FROM public.email_replies WHERE created_at > NOW() - INTERVAL '7 days') AS email_replies_last_7d,
  (SELECT COUNT(*) FROM public.calendly_events WHERE start_time > NOW()) AS upcoming_meetings,
  (SELECT COUNT(*) FROM public.form_submissions WHERE created_at > NOW() - INTERVAL '7 days') AS form_submissions_last_7d;

COMMENT ON VIEW public.v_scout_metrics IS
  'Scout: one-row dashboard of headline counts/totals across the platform.';

-- ============================================================================
-- Grants: only authenticated requests reach these views; per-request gating
-- by role lives in the API route, since views inherit RLS from base tables
-- and Scout uses the service-role client on the server.
-- ============================================================================
GRANT SELECT ON public.v_scout_users TO authenticated;
GRANT SELECT ON public.v_scout_contacts TO authenticated;
GRANT SELECT ON public.v_scout_deals TO authenticated;
GRANT SELECT ON public.v_scout_invoices TO authenticated;
GRANT SELECT ON public.v_scout_automations TO authenticated;
GRANT SELECT ON public.v_scout_pipeline_state TO authenticated;
GRANT SELECT ON public.v_scout_lists TO authenticated;
GRANT SELECT ON public.v_scout_communications TO authenticated;
GRANT SELECT ON public.v_scout_form_submissions TO authenticated;
GRANT SELECT ON public.v_scout_calendar TO authenticated;
GRANT SELECT ON public.v_scout_metrics TO authenticated;
