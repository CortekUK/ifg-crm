-- ============================================================================
-- Migration 140: Self-managed website content (CMS)
-- ============================================================================
-- Lets IFG manage frequently-changing public-website content from the CRM
-- instead of editing code: Success Stories, Gallery, and a generic "Site
-- Content" collection (ID Clinics, announcements, etc.).
--
-- Read model: the public website reads PUBLISHED rows directly via the Supabase
-- anon key, so RLS exposes only published rows to anon/authenticated. Writes are
-- restricted to admin / super_admin via the CRM admin UI.
-- ============================================================================

-- Shared updated_at touch trigger fn (reused by all three tables).
CREATE OR REPLACE FUNCTION public.website_content_touch()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- Helper: is the current auth user an admin/super_admin?
CREATE OR REPLACE FUNCTION public.is_content_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- 1. Success Stories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.website_success_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tag TEXT,
  year TEXT,
  club TEXT,
  img TEXT,            -- card image (relative /public path or Storage URL)
  hero_img TEXT,       -- detail hero image
  blurb JSONB NOT NULL DEFAULT '[]'::jsonb,  -- string[] of paragraphs (list card)
  body JSONB NOT NULL DEFAULT '[]'::jsonb,   -- string[] of paragraphs (detail)
  published BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT website_success_stories_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9_-]*$')
);

-- ---------------------------------------------------------------------------
-- 2. Gallery (category → images[])
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.website_gallery_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  blurb TEXT,
  cover TEXT,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,  -- string[] of image URLs
  published BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT website_gallery_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9_-]*$')
);

-- ---------------------------------------------------------------------------
-- 3. Generic Site Content (ID Clinics + other frequently-changing areas)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.website_site_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'id_clinic',  -- grouping key, e.g. 'id_clinic'
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  body TEXT,
  date_text TEXT,      -- freeform, e.g. '12 July 2026'
  location TEXT,
  image TEXT,
  link_url TEXT,
  link_label TEXT,
  published BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT website_site_content_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9_-]*$'),
  CONSTRAINT website_site_content_type_slug_unique UNIQUE (type, slug)
);

CREATE INDEX IF NOT EXISTS idx_website_stories_order ON public.website_success_stories(sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_website_gallery_order ON public.website_gallery_categories(sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_website_site_content_type ON public.website_site_content(type, sort_order, created_at);

-- Touch triggers
DROP TRIGGER IF EXISTS website_success_stories_touch ON public.website_success_stories;
CREATE TRIGGER website_success_stories_touch BEFORE UPDATE ON public.website_success_stories
  FOR EACH ROW EXECUTE FUNCTION public.website_content_touch();
DROP TRIGGER IF EXISTS website_gallery_touch ON public.website_gallery_categories;
CREATE TRIGGER website_gallery_touch BEFORE UPDATE ON public.website_gallery_categories
  FOR EACH ROW EXECUTE FUNCTION public.website_content_touch();
DROP TRIGGER IF EXISTS website_site_content_touch ON public.website_site_content;
CREATE TRIGGER website_site_content_touch BEFORE UPDATE ON public.website_site_content
  FOR EACH ROW EXECUTE FUNCTION public.website_content_touch();

-- ---------------------------------------------------------------------------
-- RLS: public reads published rows; admins do everything.
-- ---------------------------------------------------------------------------
ALTER TABLE public.website_success_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_gallery_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_site_content ENABLE ROW LEVEL SECURITY;

-- Success stories
DROP POLICY IF EXISTS website_stories_public_read ON public.website_success_stories;
CREATE POLICY website_stories_public_read ON public.website_success_stories
  FOR SELECT TO anon, authenticated USING (published = true);
DROP POLICY IF EXISTS website_stories_admin_all ON public.website_success_stories;
CREATE POLICY website_stories_admin_all ON public.website_success_stories
  FOR ALL TO authenticated USING (public.is_content_admin()) WITH CHECK (public.is_content_admin());

-- Gallery
DROP POLICY IF EXISTS website_gallery_public_read ON public.website_gallery_categories;
CREATE POLICY website_gallery_public_read ON public.website_gallery_categories
  FOR SELECT TO anon, authenticated USING (published = true);
DROP POLICY IF EXISTS website_gallery_admin_all ON public.website_gallery_categories;
CREATE POLICY website_gallery_admin_all ON public.website_gallery_categories
  FOR ALL TO authenticated USING (public.is_content_admin()) WITH CHECK (public.is_content_admin());

-- Site content
DROP POLICY IF EXISTS website_site_content_public_read ON public.website_site_content;
CREATE POLICY website_site_content_public_read ON public.website_site_content
  FOR SELECT TO anon, authenticated USING (published = true);
DROP POLICY IF EXISTS website_site_content_admin_all ON public.website_site_content;
CREATE POLICY website_site_content_admin_all ON public.website_site_content
  FOR ALL TO authenticated USING (public.is_content_admin()) WITH CHECK (public.is_content_admin());

COMMENT ON TABLE public.website_success_stories IS 'IFG-managed Success Stories rendered on the public website.';
COMMENT ON TABLE public.website_gallery_categories IS 'IFG-managed Gallery categories (images[]) for the public website.';
COMMENT ON TABLE public.website_site_content IS 'IFG-managed generic site content (ID Clinics etc.) for the public website.';
