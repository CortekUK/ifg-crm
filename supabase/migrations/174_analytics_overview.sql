-- Everything the Analytics page shows, in one query.
--
-- The page used to assemble its figures in the browser, and did it in ways
-- that were quietly wrong:
--
--   * Revenue and deal values were summed client-side from `.select()`
--     results. PostgREST caps a response at 1000 rows, so those sums were
--     a sum of at most a thousand rows — correct today, silently wrong later.
--   * Email open rate matched `status = 'opened'`. That status is never
--     written; opens land in `opened_at`. The rate was permanently 0%.
--   * Top recruiters counted `deals.owner_id`; the column the CRM actually
--     assigns is `deal_owner_id`.
--   * Funnel, recruiter and programme figures each ran one round trip per
--     row — three N+1 loops on every page load.
--   * Stage conversion and time-in-stage were hardcoded empty arrays behind
--     a "table not yet created" TODO. `deal_stage_history` does exist, so
--     both are computed here for real.
--
-- SECURITY INVOKER (the default): the caller's RLS applies, so this exposes
-- nothing they could not already query.
--
-- p_pipeline_id NULL means "all programmes".
CREATE OR REPLACE FUNCTION analytics_overview(
  p_start timestamptz,
  p_end timestamptz,
  p_prev_start timestamptz,
  p_prev_end timestamptz,
  p_pipeline_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH
-- Deals created in each window, already narrowed to the selected programme.
cur_deals AS (
  SELECT d.* FROM deals d
  WHERE d.created_at >= p_start AND d.created_at <= p_end
    AND (p_pipeline_id IS NULL OR d.pipeline_id = p_pipeline_id)
),
prev_deals AS (
  SELECT d.* FROM deals d
  WHERE d.created_at >= p_prev_start AND d.created_at <= p_prev_end
    AND (p_pipeline_id IS NULL OR d.pipeline_id = p_pipeline_id)
),
-- Payments, joined through to the deal so a programme filter can apply.
cur_payments AS (
  SELECT p.amount
  FROM payments p
  LEFT JOIN invoices i ON i.id = p.invoice_id
  LEFT JOIN deals d ON d.id = i.deal_id
  WHERE p.status = 'successful'
    AND p.created_at >= p_start AND p.created_at <= p_end
    AND (p_pipeline_id IS NULL OR d.pipeline_id = p_pipeline_id)
),
prev_payments AS (
  SELECT p.amount
  FROM payments p
  LEFT JOIN invoices i ON i.id = p.invoice_id
  LEFT JOIN deals d ON d.id = i.deal_id
  WHERE p.status = 'successful'
    AND p.created_at >= p_prev_start AND p.created_at <= p_prev_end
    AND (p_pipeline_id IS NULL OR d.pipeline_id = p_pipeline_id)
),
-- Stages in scope, so the funnel and the stage tables agree on what exists.
scoped_stages AS (
  SELECT s.* FROM pipeline_stages s
  WHERE p_pipeline_id IS NULL OR s.pipeline_id = p_pipeline_id
),
-- Every recorded stage move, restricted to the window and programme.
moves AS (
  SELECT h.deal_id, h.from_stage_id, h.to_stage_id, h.changed_at
  FROM deal_stage_history h
  JOIN deals d ON d.id = h.deal_id
  WHERE h.changed_at >= p_start AND h.changed_at <= p_end
    AND (p_pipeline_id IS NULL OR d.pipeline_id = p_pipeline_id)
)
SELECT jsonb_build_object(
  'generated_at', now(),

  ------------------------------------------------------------------
  -- Headline figures
  ------------------------------------------------------------------
  'kpis', jsonb_build_object(
    'leads', (SELECT count(*) FROM contacts
      WHERE created_at >= p_start AND created_at <= p_end),
    'leads_previous', (SELECT count(*) FROM contacts
      WHERE created_at >= p_prev_start AND created_at <= p_prev_end),

    'deals', (SELECT count(*) FROM cur_deals),
    'deals_previous', (SELECT count(*) FROM prev_deals),

    'deals_won', (SELECT count(*) FROM cur_deals WHERE status = 'won'),
    'deals_won_previous', (SELECT count(*) FROM prev_deals WHERE status = 'won'),

    'deals_lost', (SELECT count(*) FROM cur_deals WHERE status = 'lost'),

    -- Sums happen here, over every matching row, not over the first 1000.
    'revenue', (SELECT COALESCE(sum(amount), 0) FROM cur_payments),
    'revenue_previous', (SELECT COALESCE(sum(amount), 0) FROM prev_payments),

    'won_value', (SELECT COALESCE(sum(value), 0) FROM cur_deals WHERE status = 'won'),
    'open_value', (SELECT COALESCE(sum(value), 0) FROM cur_deals WHERE status = 'active'),

    'outstanding', (
      SELECT COALESCE(sum(i.amount), 0)
      FROM invoices i
      LEFT JOIN deals d ON d.id = i.deal_id
      WHERE i.status IN ('sent', 'viewed', 'overdue')
        AND (p_pipeline_id IS NULL OR d.pipeline_id = p_pipeline_id)),

    'unmatched_replies', (SELECT count(*) FROM email_replies
      WHERE match_status = 'unmatched'
        AND created_at >= p_start AND created_at <= p_end)
  ),

  ------------------------------------------------------------------
  -- Email engagement
  --
  -- Opens and clicks are read from `opened_at` / `clicked_at` — the
  -- columns the Resend webhook writes. `tracked` says how many sends
  -- have a delivery event at all, so the UI can tell "nobody opened it"
  -- apart from "we are not receiving open events yet".
  ------------------------------------------------------------------
  'email', (
    SELECT jsonb_build_object(
      'sent', count(*) FILTER (WHERE status <> 'failed'),
      'failed', count(*) FILTER (WHERE status = 'failed'),
      'delivered', count(*) FILTER (WHERE delivered_at IS NOT NULL),
      'opened', count(*) FILTER (WHERE opened_at IS NOT NULL),
      'clicked', count(*) FILTER (WHERE clicked_at IS NOT NULL),
      'bounced', count(*) FILTER (WHERE bounced_at IS NOT NULL),
      'tracked', count(*) FILTER (
        WHERE delivered_at IS NOT NULL OR opened_at IS NOT NULL OR bounced_at IS NOT NULL),
      'replies', (SELECT count(*) FROM email_replies
        WHERE received_at >= p_start AND received_at <= p_end)
    )
    FROM email_sends
    WHERE sent_at >= p_start AND sent_at <= p_end
  ),

  ------------------------------------------------------------------
  -- Leads per week across the window
  ------------------------------------------------------------------
  'leads_over_time', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('date', to_char(wk, 'DD Mon'), 'leads', n) ORDER BY wk)
    FROM (
      SELECT date_trunc('week', g.wk) AS wk,
             (SELECT count(*) FROM contacts c
              WHERE c.created_at >= g.wk AND c.created_at < g.wk + interval '7 days') AS n
      FROM generate_series(date_trunc('week', p_start), p_end, interval '7 days') AS g(wk)
    ) weeks
  ), '[]'::jsonb),

  ------------------------------------------------------------------
  -- Funnel: where deals are sitting right now
  ------------------------------------------------------------------
  'funnel', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'stage', name, 'type', stage_type, 'count', n
    ) ORDER BY ord)
    FROM (
      SELECT s.name,
             min(s.stage_type) AS stage_type,
             min(s.display_order) AS ord,
             (SELECT count(*) FROM deals d
              WHERE d.current_stage_id IN (
                SELECT s2.id FROM scoped_stages s2 WHERE s2.name = s.name)) AS n
      FROM scoped_stages s
      GROUP BY s.name
    ) f
  ), '[]'::jsonb),

  ------------------------------------------------------------------
  -- Stage conversion: of the deals that reached a stage, how many went
  -- on to leave it.
  --
  -- "Reached" cannot mean "has a move INTO this stage": a deal is created
  -- sitting in the first stage, so its only history row names that stage
  -- as the one it moved OUT of. Counting arrivals alone gave the first
  -- stage one entrant and eight leavers — a rate of 800%. A deal has been
  -- in a stage if it moved either into or out of it, which makes the
  -- leavers a subset of the entrants and the rate bounded by 100%.
  ------------------------------------------------------------------
  'stage_conversion', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'stage', stage_name, 'entered', entered, 'advanced', advanced,
      'rate', CASE WHEN entered > 0 THEN round((advanced::numeric / entered) * 100, 1) ELSE 0 END
    ) ORDER BY ord)
    FROM (
      SELECT s.name AS stage_name,
             min(s.display_order) AS ord,
             count(DISTINCT t.deal_id) AS entered,
             count(DISTINCT t.deal_id) FILTER (WHERE t.left_it) AS advanced
      FROM scoped_stages s
      JOIN (
        SELECT m.deal_id, m.to_stage_id AS stage_id, false AS left_it FROM moves m
        UNION ALL
        SELECT m.deal_id, m.from_stage_id AS stage_id, true AS left_it FROM moves m
        WHERE m.from_stage_id IS NOT NULL
      ) t ON t.stage_id = s.id
      GROUP BY s.name
    ) sc
  ), '[]'::jsonb),

  ------------------------------------------------------------------
  -- How long a deal sits in a stage before moving on. Measured between
  -- consecutive recorded moves for the same deal, so only completed
  -- spells count — a deal still sitting in a stage has no duration yet.
  ------------------------------------------------------------------
  'time_in_stage', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'stage', stage_name, 'avg_days', avg_days, 'samples', samples
    ) ORDER BY ord)
    FROM (
      SELECT s.name AS stage_name,
             min(s.display_order) AS ord,
             round(avg(EXTRACT(epoch FROM sp.left_at - sp.entered_at) / 86400)::numeric, 1) AS avg_days,
             count(*) AS samples
      FROM (
        SELECT m.to_stage_id AS stage_id,
               m.changed_at AS entered_at,
               lead(m.changed_at) OVER (PARTITION BY m.deal_id ORDER BY m.changed_at) AS left_at
        FROM moves m
      ) sp
      JOIN scoped_stages s ON s.id = sp.stage_id
      WHERE sp.left_at IS NOT NULL
      GROUP BY s.name
    ) t
  ), '[]'::jsonb),

  ------------------------------------------------------------------
  -- Revenue by month, last six months (ignores the window on purpose —
  -- a trend line needs more than the selected period to be a trend).
  ------------------------------------------------------------------
  'revenue_by_month', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('month', to_char(m, 'Mon'), 'revenue', amt) ORDER BY m)
    FROM (
      SELECT g.m,
             COALESCE((
               SELECT sum(p.amount)
               FROM payments p
               LEFT JOIN invoices i ON i.id = p.invoice_id
               LEFT JOIN deals d ON d.id = i.deal_id
               WHERE p.status = 'successful'
                 AND p.created_at >= g.m AND p.created_at < g.m + interval '1 month'
                 AND (p_pipeline_id IS NULL OR d.pipeline_id = p_pipeline_id)
             ), 0) AS amt
      FROM generate_series(
        date_trunc('month', now()) - interval '5 months',
        date_trunc('month', now()),
        interval '1 month') AS g(m)
    ) r
  ), '[]'::jsonb),

  ------------------------------------------------------------------
  -- Where leads come from
  ------------------------------------------------------------------
  'lead_sources', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('name', src, 'value', n) ORDER BY n DESC)
    FROM (
      SELECT COALESCE(NULLIF(source, ''), 'unknown') AS src, count(*) AS n
      FROM contacts
      WHERE created_at >= p_start AND created_at <= p_end
      GROUP BY 1
      ORDER BY n DESC
      LIMIT 8
    ) s
  ), '[]'::jsonb),

  ------------------------------------------------------------------
  -- Recruiters, by the deals they own. Uses deal_owner_id — the column
  -- the CRM actually assigns.
  ------------------------------------------------------------------
  'recruiters', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', name, 'deals', deals, 'won', won, 'value', value
    ) ORDER BY deals DESC, won DESC)
    FROM (
      SELECT COALESCE(pr.full_name, pr.email) AS name,
             count(cd.id) AS deals,
             count(cd.id) FILTER (WHERE cd.status = 'won') AS won,
             COALESCE(sum(cd.value), 0) AS value
      FROM profiles pr
      JOIN cur_deals cd ON cd.deal_owner_id = pr.id
      WHERE pr.is_active
      GROUP BY 1
      ORDER BY deals DESC
      LIMIT 6
    ) r
  ), '[]'::jsonb),

  ------------------------------------------------------------------
  -- Programme performance
  ------------------------------------------------------------------
  'programmes', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'programme', name, 'deals', deals, 'won', won, 'value', value
    ) ORDER BY deals DESC)
    FROM (
      SELECT pl.name,
             count(cd.id) AS deals,
             count(cd.id) FILTER (WHERE cd.status = 'won') AS won,
             COALESCE(sum(cd.value), 0) AS value
      FROM pipelines pl
      LEFT JOIN cur_deals cd ON cd.pipeline_id = pl.id
      GROUP BY pl.name
    ) p
  ), '[]'::jsonb),

  ------------------------------------------------------------------
  -- Automation health over the window
  ------------------------------------------------------------------
  'automation', (
    SELECT jsonb_build_object(
      'active', (SELECT count(*) FROM automations WHERE is_active),
      'enrolled', (SELECT count(*) FROM automation_enrollments WHERE status = 'active'),
      'sent', count(*) FILTER (WHERE status = 'sent'),
      'failed', count(*) FILTER (WHERE status = 'failed'),
      'skipped', count(*) FILTER (WHERE status = 'skipped')
    )
    FROM automation_logs
    WHERE sent_at >= p_start AND sent_at <= p_end
  )
);
$$;

COMMENT ON FUNCTION analytics_overview IS
  'Every figure on the Analytics page, computed in SQL so nothing is capped at the 1000-row PostgREST limit.';
