-- Per-call OpenAI usage tracking. Server routes that call OpenAI
-- (scout chat, template AI generator, etc.) write one row per
-- completion with the model used, the token counts the API returned,
-- the wall-clock latency, and a USD cost computed from a small pricing
-- table in lib/ai/usage-logger.ts.
--
-- The /openai-usage page (super_admin only) reads from this table to
-- show cost-control dashboards: total spend, calls, tokens, daily
-- spend bar chart, by-feature breakdown.

CREATE TABLE IF NOT EXISTS public.openai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Feature key — short identifier for the calling code path.
  -- e.g. 'scout-chat', 'template-ai-generate', 'reply-intent'.
  feature TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  -- Cost computed at log-time from lib/ai/usage-logger.ts pricing table.
  -- Stored separately so the dashboards don't need to know about
  -- pricing changes — historical rows keep the cost they were logged
  -- at, which matches how a finance ledger should behave.
  cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  -- When the OpenAI call failed (validation error, refusal, network
  -- blip), the catch block still logs the row with error set so we
  -- can surface "errors still cost tokens" warnings in the UI.
  error TEXT,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_openai_usage_created_at
  ON public.openai_usage_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_openai_usage_feature
  ON public.openai_usage_logs (feature);

-- Super_admin only — finance / cost-control data is sensitive.
ALTER TABLE public.openai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS openai_usage_super_admin ON public.openai_usage_logs;
CREATE POLICY openai_usage_super_admin
  ON public.openai_usage_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

COMMENT ON TABLE public.openai_usage_logs IS
  'Per-call OpenAI usage + cost. Written by server routes via lib/ai/usage-logger.ts. Read by the /openai-usage super_admin dashboard.';
