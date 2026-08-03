-- ============================================================================
-- Migration 144: Website News (Latest News) — CMS-managed articles
-- ============================================================================
-- The /news list and /news/<slug> detail pages are driven by bundled ARTICLES
-- in web/lib/data.ts. This table lets IFG manage them from the CRM. Same read
-- model as migration 140: public reads published rows via the anon key; writes
-- are admin/super_admin only. Reuses website_content_touch() from migration 140.
--
-- `body` is a JSONB array of blocks mirroring web/lib/data.ts ArticleBlock:
--   { "type": "p"|"h"|"quote", "text": "..." }
--   { "type": "img", "src": "...", "caption": "..." }
--   { "type": "duo", "src": "...", "src2": "...", "caption": "..." }
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.website_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'Latest News',   -- pill label
  title TEXT NOT NULL,
  date_text TEXT,                                 -- display date, e.g. '19 May 2026'
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- sort key (newest first)
  excerpt TEXT,                                   -- card + meta description
  img TEXT,                                       -- portrait card image
  hero_img TEXT,                                  -- article hero image
  lead TEXT,                                      -- optional pull-quote near the top
  body JSONB NOT NULL DEFAULT '[]'::jsonb,        -- ArticleBlock[]
  published BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT website_news_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9_-]*$')
);

CREATE INDEX IF NOT EXISTS idx_website_news_order ON public.website_news(published_at DESC, created_at DESC);

DROP TRIGGER IF EXISTS website_news_touch ON public.website_news;
CREATE TRIGGER website_news_touch BEFORE UPDATE ON public.website_news
  FOR EACH ROW EXECUTE FUNCTION public.website_content_touch();

ALTER TABLE public.website_news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS website_news_public_read ON public.website_news;
CREATE POLICY website_news_public_read ON public.website_news
  FOR SELECT TO anon, authenticated USING (published = true);
DROP POLICY IF EXISTS website_news_admin_all ON public.website_news;
CREATE POLICY website_news_admin_all ON public.website_news
  FOR ALL TO authenticated USING (public.is_content_admin()) WITH CHECK (public.is_content_admin());

COMMENT ON TABLE public.website_news IS 'IFG-managed Latest News articles rendered on the public website (/news).';
