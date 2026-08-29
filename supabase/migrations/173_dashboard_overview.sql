-- Everything the dashboard shows, in one query.
--
-- The old dashboard assembled its numbers in the browser: fourteen parallel
-- requests, several of which pulled rows back to sum them client-side. That
-- has the same failure the campaign composer had — PostgREST caps a response
-- at 1000 rows, so "total pipeline value" was the sum of at most a thousand
-- deals and would have gone quietly wrong at the thousand-and-first.
--
-- Counting belongs in the database. This also lets a comparison be a real
-- comparison: the previous trends trended a CURRENT status against rows
-- CREATED before last month, which cannot be right even in principle.
--
-- SECURITY INVOKER (the default): the caller's RLS applies, so this exposes
-- nothing they could not already query.
CREATE OR REPLACE FUNCTION dashboard_overview()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
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
    'unmatched_sms', (SELECT count(*) FROM sms_messages
      WHERE match_status = 'unmatched' AND direction = 'inbound'),
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
$$;

COMMENT ON FUNCTION dashboard_overview() IS
  'Every dashboard figure in one round trip, counted in SQL so no total is capped at the PostgREST 1000-row limit.';

GRANT EXECUTE ON FUNCTION dashboard_overview() TO authenticated;
