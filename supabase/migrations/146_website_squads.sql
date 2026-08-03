-- ============================================================================
-- Migration 146: Website Squads (Teams page) — CMS-managed playing squads
-- ============================================================================
-- The /programmes/macclesfield/teams tiles and each squad detail page
-- (/programmes/macclesfield/teams/<slug>) are driven by bundled SQUADS in
-- web/lib/data.ts. This table lets IFG add / edit / remove squads from the CRM,
-- including each squad's player roster. Same read model as migration 144:
-- public reads published rows via the anon key; writes are admin/super_admin
-- only. Reuses website_content_touch() from migration 140.
--
-- `intro`  is a JSONB array of paragraph strings.
-- `roster` is a JSONB array of players: { "name": "...", "pos": "GK" }
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.website_squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,                       -- URL segment, e.g. 'u19'
  name TEXT NOT NULL,                              -- tile label, e.g. 'U19 Squad'
  title TEXT NOT NULL DEFAULT '',                  -- page title, e.g. 'Under 19 Playing Squad'
  hero_img TEXT,                                   -- wide hero image
  photo TEXT,                                      -- squad team photo / tile image
  intro JSONB NOT NULL DEFAULT '[]'::jsonb,        -- string[] intro paragraphs
  league_url TEXT,                                 -- optional external league table link
  roster JSONB NOT NULL DEFAULT '[]'::jsonb,       -- { name, pos }[]
  published BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT website_squads_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9_-]*$')
);

CREATE INDEX IF NOT EXISTS idx_website_squads_order ON public.website_squads(sort_order ASC, created_at ASC);

DROP TRIGGER IF EXISTS website_squads_touch ON public.website_squads;
CREATE TRIGGER website_squads_touch BEFORE UPDATE ON public.website_squads
  FOR EACH ROW EXECUTE FUNCTION public.website_content_touch();

ALTER TABLE public.website_squads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS website_squads_public_read ON public.website_squads;
CREATE POLICY website_squads_public_read ON public.website_squads
  FOR SELECT TO anon, authenticated USING (published = true);
DROP POLICY IF EXISTS website_squads_admin_all ON public.website_squads;
CREATE POLICY website_squads_admin_all ON public.website_squads
  FOR ALL TO authenticated USING (public.is_content_admin()) WITH CHECK (public.is_content_admin());

COMMENT ON TABLE public.website_squads IS 'IFG-managed playing squads rendered on the public Teams pages.';
