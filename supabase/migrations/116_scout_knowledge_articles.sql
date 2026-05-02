-- ============================================================================
-- Migration 116: Scout knowledge-base articles
-- ============================================================================
-- Long-form documentation that Scout can cite when the system-prompt glossary
-- doesn't cover a question. Super_admins edit articles via /admin/scout/knowledge;
-- Scout reads them via the query_knowledge tool.
--
-- The model never edits these — it only reads — so the table stays simple.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.scout_knowledge_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Slug: URL-safe identifier the user (and Scout) can use to address an
  -- article directly. Unique so multiple articles can't share an alias.
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  -- Free-form tags so we can search by topic without a separate join table.
  -- Examples: ['automation','meeting_scheduler'], ['replies','smart-deal'].
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scout_knowledge_articles_slug_format
    CHECK (slug ~ '^[a-z0-9][a-z0-9_-]*$')
);

CREATE INDEX IF NOT EXISTS idx_scout_knowledge_articles_updated
  ON public.scout_knowledge_articles(updated_at DESC);

-- GIN index on tags so query_knowledge can filter by tag in O(log n) without
-- a sequential scan as the corpus grows.
CREATE INDEX IF NOT EXISTS idx_scout_knowledge_articles_tags
  ON public.scout_knowledge_articles USING GIN (tags);

-- updated_at touch trigger so edits surface in "recently changed" lists.
CREATE OR REPLACE FUNCTION public.scout_knowledge_articles_touch()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scout_knowledge_articles_touch_trigger ON public.scout_knowledge_articles;
CREATE TRIGGER scout_knowledge_articles_touch_trigger
BEFORE UPDATE ON public.scout_knowledge_articles
FOR EACH ROW EXECUTE FUNCTION public.scout_knowledge_articles_touch();

-- RLS: only super_admins can read/write. Scout itself uses the service-role
-- client so it bypasses RLS, but the admin UI uses the user session — these
-- policies keep that path locked down.
ALTER TABLE public.scout_knowledge_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scout_knowledge_articles_super_admin_all ON public.scout_knowledge_articles;
CREATE POLICY scout_knowledge_articles_super_admin_all
  ON public.scout_knowledge_articles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

COMMENT ON TABLE public.scout_knowledge_articles IS
  'Long-form docs Scout can cite when the system-prompt glossary is not enough.';
