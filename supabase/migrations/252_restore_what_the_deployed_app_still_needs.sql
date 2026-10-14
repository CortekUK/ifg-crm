-- Migration 252: URGENT — undo the parts of 249 the deployed app still needs.
--
-- Migration 249 removed SMS from the database. The application code that stops
-- using SMS is written but NOT DEPLOYED, so production is still asking for
-- things 249 took away. Same mistake as 251: the schema moved ahead of the
-- deploy.
--
-- TWO VISIBLE FAULTS THIS FIXES
--
-- 1. The dashboard. The deployed code computes:
--        data.attention.unmatched_sms + data.attention.unmatched_email
--    249 removed the unmatched_sms key, so that became
--        undefined + 0  ->  NaN
--    and the "Needs attention" figure read NaN for every user on the main
--    dashboard. The key is restored as a constant 0 — truthful, since there is
--    no SMS any more, and it makes the deployed arithmetic work again.
--
-- 2. The SMS Replies tab. The deployed Replies screen queries sms_messages,
--    which 249 dropped, so the request fails with PGRST205. The three tables
--    come back EMPTY, with the same columns the generated types recorded, so
--    those queries resolve and return nothing — which is the correct answer,
--    because SMS was never used. Note the deployed SMS list was already broken
--    before any of this work: it filters on sms_messages.read, a column that
--    has never existed in any migration. That is pre-existing and not fixed
--    here.
--
-- AFTER THE DEPLOY, re-apply the removal by running 249 again. Everything in
-- this file is deliberately reversible for exactly that reason.

-- ── 1. the dashboard key ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dashboard_overview_all()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
WITH
-- Stage types that mean the deal is no longer in play.
closed AS (
  SELECT id FROM pipeline_stages
  WHERE stage_type IN ('completed', 'lost', 'dead', 'dormant')
),
open_deals AS (
  SELECT d.* FROM deals d
  WHERE d.current_stage_id IS NULL OR d.current_stage_id NOT IN (SELECT id FROM closed)
),
month_start AS (SELECT date_trunc('month', now()) AS d)
SELECT jsonb_build_object(
  'generated_at', now(),

  'contacts', jsonb_build_object(
    'total', (SELECT count(*) FROM contacts),
    'added_7d', (SELECT count(*) FROM contacts WHERE created_at > now() - interval '7 days'),
    'added_prev_7d', (SELECT count(*) FROM contacts
      WHERE created_at > now() - interval '14 days' AND created_at <= now() - interval '7 days')
  ),

  'deals', jsonb_build_object(
    'open', (SELECT count(*) FROM open_deals),
    'open_value', (SELECT coalesce(sum(deal_value), 0) FROM open_deals),
    'won', (SELECT count(*) FROM deals d JOIN pipeline_stages s ON s.id = d.current_stage_id
            WHERE s.stage_type = 'completed'),
    'created_this_month', (SELECT count(*) FROM deals, month_start WHERE created_at >= month_start.d),
    -- A full calendar month, not "up to midnight on the last day" — the old
    -- window silently dropped the final day of every comparison.
    'created_last_month', (SELECT count(*) FROM deals, month_start
      WHERE created_at >= month_start.d - interval '1 month' AND created_at < month_start.d),
    -- Nothing has happened on these in a fortnight. stage_entered_at is unset
    -- on every row in this database, so activity is the honest signal.
    'stalled', (SELECT count(*) FROM open_deals
      WHERE coalesce(last_activity_at, updated_at, created_at) < now() - interval '14 days')
  ),

  'by_stage', (
    SELECT coalesce(jsonb_agg(x ORDER BY x->>'pipeline', (x->>'display_order')::int), '[]'::jsonb)
    FROM (
      SELECT jsonb_build_object(
        'stage', s.name, 'pipeline', p.name, 'display_order', s.display_order,
        'colour', s.color, 'count', count(d.id),
        'value', coalesce(sum(d.deal_value), 0)
      ) AS x
      FROM pipeline_stages s
      JOIN pipelines p ON p.id = s.pipeline_id
      LEFT JOIN deals d ON d.current_stage_id = s.id
      WHERE p.is_active AND s.stage_type NOT IN ('dead', 'lost', 'dormant')
      GROUP BY p.name, s.name, s.display_order, s.color
      HAVING count(d.id) > 0
    ) t
  ),

  'automation', jsonb_build_object(
    'active', (SELECT count(*) FROM automations WHERE is_active),
    'enrolled', (SELECT count(*) FROM automation_enrollments WHERE status = 'active')
  ),

  'email', jsonb_build_object(
    'sent_7d', (SELECT count(*) FROM email_sends WHERE sent_at > now() - interval '7 days'),
    'sent_today', (SELECT count(*) FROM email_sends WHERE sent_at >= date_trunc('day', now())),
    'opened_7d', (SELECT count(*) FROM email_sends
      WHERE sent_at > now() - interval '7 days' AND opened_at IS NOT NULL),
    'failed_7d', (SELECT count(*) FROM email_sends
      WHERE sent_at > now() - interval '7 days' AND status IN ('failed', 'bounced'))
  ),

  -- Only things a person can actually do something about.
  'attention', jsonb_build_object(
    -- Restored in migration 252. The deployed dashboard computes
    --   attention.unmatched_sms + attention.unmatched_email
    -- so removing the key gave undefined + number = NaN on the live Needs
    -- Attention widget for every user. SMS is gone, so the honest value is a
    -- constant 0 rather than a count of a table that no longer exists.
    'unmatched_sms', 0,
    'unmatched_email', (SELECT count(*) FROM email_replies WHERE match_status = 'unmatched'),
    'overdue_invoices', (SELECT count(*) FROM invoices WHERE status = 'overdue'),
    'overdue_value', (SELECT coalesce(sum(amount), 0) FROM invoices WHERE status = 'overdue'),
    'brochures_unrendered', (SELECT count(*) FROM website_brochures
      -- page_images is jsonb, not a text[]: jsonb_array_length, and a guard
      -- for the rows where it is null rather than an empty array.
      WHERE pdf_url IS NOT NULL
        AND coalesce(jsonb_array_length(coalesce(page_images, '[]'::jsonb)), 0) = 0),
    'draft_templates', (SELECT count(*) FROM email_templates WHERE is_draft)
  ),

  -- Money and meetings. Both cards that showed these summed rows fetched into
  -- the browser, so both were capped at 1000 invoices / 1000 activities.
  'finance', jsonb_build_object(
    'paid_this_month', (SELECT coalesce(sum(amount), 0) FROM invoices, month_start
      WHERE status = 'paid' AND paid_at >= month_start.d),
    'paid_last_month', (SELECT coalesce(sum(amount), 0) FROM invoices, month_start
      WHERE status = 'paid' AND paid_at >= month_start.d - interval '1 month'
        AND paid_at < month_start.d),
    'outstanding', (SELECT coalesce(sum(amount), 0) FROM invoices
      WHERE status IN ('sent', 'overdue')),
    'outstanding_count', (SELECT count(*) FROM invoices WHERE status IN ('sent', 'overdue'))
  ),

  -- A call is a DEAL that entered a stage of type 'meeting' — Zoom Scheduled
  -- and the like. Counted DISTINCT: the activity log records every movement,
  -- and a deal dragged out of the stage and back in is one call, not two.
  -- Counting rows said 7 where the honest answer was 5.
  'meetings', jsonb_build_object(
    'this_week', (SELECT count(DISTINCT a.deal_id) FROM deal_activities a
      WHERE a.activity_type = 'stage_changed'
        AND a.created_at >= date_trunc('week', now())
        AND (a.new_value->>'stage_id')::uuid IN
            (SELECT id FROM pipeline_stages WHERE stage_type = 'meeting')),
    'this_month', (SELECT count(DISTINCT a.deal_id) FROM deal_activities a, month_start
      WHERE a.activity_type = 'stage_changed'
        AND a.created_at >= month_start.d
        AND (a.new_value->>'stage_id')::uuid IN
            (SELECT id FROM pipeline_stages WHERE stage_type = 'meeting')),
    -- How many are sitting in that stage right now, which is the number
    -- someone actually has to prepare for.
    'waiting_now', (SELECT count(*) FROM deals d
      JOIN pipeline_stages s ON s.id = d.current_stage_id
      WHERE s.stage_type = 'meeting')
  ),

  -- Which sequences people are actually in. 22 automations exist; the useful
  -- question is which ones are doing anything.
  'top_automations', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'enrolled', enrolled) ORDER BY enrolled DESC), '[]'::jsonb)
    FROM (
      SELECT au.id, au.name,
             count(e.id) FILTER (WHERE e.status = 'active') AS enrolled
      FROM automations au
      LEFT JOIN automation_enrollments e ON e.automation_id = au.id
      WHERE au.is_active
      GROUP BY au.id, au.name
      HAVING count(e.id) FILTER (WHERE e.status = 'active') > 0
      ORDER BY enrolled DESC LIMIT 5
    ) t
  ),

  'last_campaign', (
    SELECT jsonb_build_object(
      'id', c.id, 'name', c.name, 'sent_at', c.sent_at,
      'recipients', (SELECT count(*) FROM campaign_recipients r WHERE r.campaign_id = c.id),
      'delivered', (SELECT count(*) FROM campaign_recipients r
        WHERE r.campaign_id = c.id AND r.delivered_at IS NOT NULL),
      'opened', (SELECT count(*) FROM campaign_recipients r
        WHERE r.campaign_id = c.id AND r.opened_at IS NOT NULL),
      'clicked', (SELECT count(*) FROM campaign_recipients r
        WHERE r.campaign_id = c.id AND r.clicked_at IS NOT NULL)
    )
    FROM campaigns c WHERE c.status = 'sent' ORDER BY c.sent_at DESC NULLS LAST LIMIT 1
  ),

  -- One row per brochure: people, opens, downloads. A person who opens it
  -- five times is one person and five opens, which is the distinction the
  -- brochures page itself now makes.
  'brochures', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'title', b.title, 'slug', b.slug,
      'people', (SELECT count(DISTINCT coalesce(v.email, v.contact_id::text))
                 FROM brochure_views v WHERE v.brochure_id = b.id),
      'opens', (SELECT count(*) FROM brochure_views v
                WHERE v.brochure_id = b.id AND coalesce(v.kind, 'view') = 'view'),
      'downloads', (SELECT count(*) FROM brochure_views v
                    WHERE v.brochure_id = b.id AND v.kind = 'download')
    ) ORDER BY b.sort_order, b.title), '[]'::jsonb)
    FROM website_brochures b WHERE b.published
  ),

  -- Counted here for the same reason as everything else: the chart used to
  -- pull contacts.source into the browser and tally it, which meant it drew
  -- percentages of the first 1000 contacts and labelled them as the whole
  -- database — 1% of it, presented as 100%.
  'lead_sources', (
    SELECT coalesce(jsonb_agg(jsonb_build_object('source', src, 'count', n)
                              ORDER BY n DESC), '[]'::jsonb)
    FROM (
      SELECT coalesce(nullif(source, ''), 'unknown') AS src, count(*) AS n
      FROM contacts GROUP BY 1 ORDER BY n DESC LIMIT 8
    ) t
  ),

  'top_lists', (
    SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
      SELECT jsonb_build_object('id', l.id, 'name', l.name, 'count', count(cl.contact_id)) AS x
      FROM lists l LEFT JOIN contact_lists cl ON cl.list_id = l.id
      GROUP BY l.id, l.name ORDER BY count(cl.contact_id) DESC LIMIT 5
    ) t
  ),

  'top_tags', (
    SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
      SELECT jsonb_build_object('id', tg.id, 'name', tg.name, 'colour', tg.color,
                                'count', count(ct.contact_id)) AS x
      FROM tags tg LEFT JOIN contact_tags ct ON ct.tag_id = tg.id
      GROUP BY tg.id, tg.name, tg.color ORDER BY count(ct.contact_id) DESC LIMIT 5
    ) t
  )
);
$function$;

-- ── 2. the SMS tables, empty, matching what the deployed code expects ────
CREATE TABLE IF NOT EXISTS sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content TEXT NOT NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  click_send_number TEXT,
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL,
  ai_intent TEXT,
  ai_intent_confidence DECIMAL(3,2),
  match_status TEXT NOT NULL DEFAULT 'unmatched',
  matched_by_id UUID REFERENCES profiles(id),
  matched_at TIMESTAMPTZ,
  follow_up_status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sms_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  portal_user_id UUID,
  from_number TEXT,
  to_number TEXT,
  body TEXT,
  direction TEXT,
  status TEXT,
  raw_payload JSONB,
  read BOOLEAN DEFAULT false,
  received_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sms_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  recipient_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  recipient_phone TEXT,
  content TEXT,
  status TEXT,
  clicksend_message_id TEXT,
  segments INTEGER DEFAULT 1,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff-only reads, matching how every other reply table is scoped. These
-- tables hold nothing and never will, but an unreadable table would fail the
-- deployed query just as a missing one does.
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_replies  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_sends    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sms_messages_select ON sms_messages;
CREATE POLICY sms_messages_select ON sms_messages FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));

DROP POLICY IF EXISTS sms_replies_select ON sms_replies;
CREATE POLICY sms_replies_select ON sms_replies FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));

DROP POLICY IF EXISTS sms_sends_select ON sms_sends;
CREATE POLICY sms_sends_select ON sms_sends FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));

COMMENT ON TABLE sms_messages IS
  'Empty. Recreated in migration 252 only so the not-yet-deployed SMS removal does not break the live Replies screen. Drop again (re-run 249) once the app is deployed.';
