-- ============================================================================
-- Migration 142: Page-by-page CMS + per-programme package/deposit pricing
-- ============================================================================
-- Phase 1 (Foundation) of the CMS rebuild (see CMS_PLAN.md). Purely ADDITIVE:
-- existing website_* tables, modals, routes and RLS are untouched.
--
--   website_pages            - per-page content OVERRIDES (jsonb) merged onto the
--                              website's bundled defaults (web/lib/data.ts). No
--                              override => page renders exactly as today.
--   website_packages         - programme packages: the SINGLE SOURCE OF TRUTH for
--                              both the website price display AND the authoritative
--                              Stripe charge amount (checkout validates against
--                              PUBLISHED rows here).
--   website_pricing_settings - per-programme default deposit + card-fee (advanced).
--
-- Read model matches migration 140: public (anon) reads PUBLISHED rows via the
-- Supabase anon key; writes restricted to admin/super_admin via is_content_admin().
-- Reuses the shared website_content_touch() trigger fn from migration 140.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Page content overrides
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.website_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,          -- 'home' | 'summer-residency' | 'university' | 'gap-year' | ...
  title TEXT NOT NULL,                -- CMS display name
  route TEXT,                         -- public route, e.g. '/programmes/macclesfield/summer'
  overrides JSONB NOT NULL DEFAULT '{}'::jsonb,  -- ONLY changed fields (path-keyed partial doc)
  published BOOLEAN NOT NULL DEFAULT false,      -- draft until explicitly published
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT website_pages_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9_-]*$')
);

-- ---------------------------------------------------------------------------
-- 2. Programme packages (display + authoritative charge amounts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.website_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme TEXT NOT NULL,            -- 'residency' | 'university' | 'gapyear'
  key TEXT NOT NULL,                  -- stable id within a programme: 'A'..'F', 'programme', 'half-1'
  label TEXT NOT NULL,               -- "Full 6 Weeks"
  subtitle TEXT,                      -- dates / season, e.g. "June 20th – Aug 1st"
  duration TEXT,                      -- "6 weeks"
  full_amount INT,                    -- authoritative full charge (whole GBP); null = not payable in full
  deposit_amount INT,                 -- per-package deposit override (whole GBP); null = use programme default
  deposit_enabled BOOLEAN NOT NULL DEFAULT true,
  full_enabled BOOLEAN NOT NULL DEFAULT true,
  currency TEXT NOT NULL DEFAULT 'GBP',
  breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,   -- display-only lines [{label,value}]
  featured BOOLEAN NOT NULL DEFAULT false,
  published BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT website_packages_programme_key_unique UNIQUE (programme, key),
  CONSTRAINT website_packages_amount_nonneg CHECK (
    (full_amount IS NULL OR full_amount >= 0) AND (deposit_amount IS NULL OR deposit_amount >= 0)
  )
);

-- ---------------------------------------------------------------------------
-- 3. Per-programme pricing settings (default deposit + advanced card fee)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.website_pricing_settings (
  programme TEXT PRIMARY KEY,         -- 'residency' | 'university' | 'gapyear'
  deposit_default INT,               -- default deposit (whole GBP); null = programme has no deposit
  deposit_enabled BOOLEAN NOT NULL DEFAULT true,  -- does this programme take deposits at all
  fee_rate NUMERIC NOT NULL DEFAULT 0.035,        -- advanced: card-fee percentage (gross-up)
  fee_fixed NUMERIC NOT NULL DEFAULT 0.20,        -- advanced: card-fee fixed amount
  currency TEXT NOT NULL DEFAULT 'GBP',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT website_pricing_fee_rate_range CHECK (fee_rate >= 0 AND fee_rate < 1)
);

CREATE INDEX IF NOT EXISTS idx_website_packages_programme ON public.website_packages(programme, sort_order, created_at);

-- Touch triggers (reuse website_content_touch from migration 140)
DROP TRIGGER IF EXISTS website_pages_touch ON public.website_pages;
CREATE TRIGGER website_pages_touch BEFORE UPDATE ON public.website_pages
  FOR EACH ROW EXECUTE FUNCTION public.website_content_touch();
DROP TRIGGER IF EXISTS website_packages_touch ON public.website_packages;
CREATE TRIGGER website_packages_touch BEFORE UPDATE ON public.website_packages
  FOR EACH ROW EXECUTE FUNCTION public.website_content_touch();
DROP TRIGGER IF EXISTS website_pricing_settings_touch ON public.website_pricing_settings;
CREATE TRIGGER website_pricing_settings_touch BEFORE UPDATE ON public.website_pricing_settings
  FOR EACH ROW EXECUTE FUNCTION public.website_content_touch();

-- ---------------------------------------------------------------------------
-- RLS: public reads published rows; admins do everything.
-- Pricing settings are NOT public-readable (fee internals) — the website resolves
-- display prices from packages; the server (service role) reads settings at checkout.
-- ---------------------------------------------------------------------------
ALTER TABLE public.website_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_pricing_settings ENABLE ROW LEVEL SECURITY;

-- Pages
DROP POLICY IF EXISTS website_pages_public_read ON public.website_pages;
CREATE POLICY website_pages_public_read ON public.website_pages
  FOR SELECT TO anon, authenticated USING (published = true);
DROP POLICY IF EXISTS website_pages_admin_all ON public.website_pages;
CREATE POLICY website_pages_admin_all ON public.website_pages
  FOR ALL TO authenticated USING (public.is_content_admin()) WITH CHECK (public.is_content_admin());

-- Packages
DROP POLICY IF EXISTS website_packages_public_read ON public.website_packages;
CREATE POLICY website_packages_public_read ON public.website_packages
  FOR SELECT TO anon, authenticated USING (published = true);
DROP POLICY IF EXISTS website_packages_admin_all ON public.website_packages;
CREATE POLICY website_packages_admin_all ON public.website_packages
  FOR ALL TO authenticated USING (public.is_content_admin()) WITH CHECK (public.is_content_admin());

-- Pricing settings (admin-only; no public policy)
DROP POLICY IF EXISTS website_pricing_settings_admin_all ON public.website_pricing_settings;
CREATE POLICY website_pricing_settings_admin_all ON public.website_pricing_settings
  FOR ALL TO authenticated USING (public.is_content_admin()) WITH CHECK (public.is_content_admin());

COMMENT ON TABLE public.website_pages IS 'IFG-managed per-page content overrides merged onto bundled website defaults.';
COMMENT ON TABLE public.website_packages IS 'IFG-managed programme packages: single source of truth for website price display AND authoritative Stripe charge amounts.';
COMMENT ON TABLE public.website_pricing_settings IS 'Per-programme default deposit + advanced card-fee settings (admin-only).';

-- ============================================================================
-- SEED — mirrors the current bundled prices exactly (zero day-one change).
--   Summer: web/lib/data.ts SUMMER_RESIDENCY.options (A–F)
--   University: UNIVERSITY_FULL_AMOUNT (18500) + costs display
--   Gap Year: GAP_YEAR.costs (display only — no deposit / no online payment)
-- ============================================================================

-- Pricing settings
INSERT INTO public.website_pricing_settings (programme, deposit_default, deposit_enabled, fee_rate, fee_fixed)
VALUES
  ('residency',  2000, true,  0.035, 0.20),
  ('university', 2000, true,  0.035, 0.20),
  ('gapyear',    NULL, false, 0.035, 0.20)
ON CONFLICT (programme) DO NOTHING;

-- Summer Residency packages (deposit £2,000 via programme default)
INSERT INTO public.website_packages
  (programme, key, label, subtitle, duration, full_amount, deposit_amount, deposit_enabled, full_enabled, breakdown, featured, published, sort_order)
VALUES
  ('residency', 'A', 'Full 6 Weeks',  'June 20th – Aug 1st',  '6 weeks', 8000, NULL, true, true, '[]'::jsonb, true,  true, 0),
  ('residency', 'B', 'First 4 Weeks', 'June 20th – July 18th','4 weeks', 6000, NULL, true, true, '[]'::jsonb, false, true, 1),
  ('residency', 'C', 'Last 4 Weeks',  'June 5th – Aug 1st',   '4 weeks', 6000, NULL, true, true, '[]'::jsonb, false, true, 2),
  ('residency', 'D', 'First 2 Weeks', 'June 20th – July 4th', '2 weeks', 3500, NULL, true, true, '[]'::jsonb, false, true, 3),
  ('residency', 'E', 'Middle 2 Weeks','July 5th – July 18th', '2 weeks', 3500, NULL, true, true, '[]'::jsonb, false, true, 4),
  ('residency', 'F', 'Last 2 Weeks',  'July 19th – Aug 1st',  '2 weeks', 3500, NULL, true, true, '[]'::jsonb, false, true, 5)
ON CONFLICT (programme, key) DO NOTHING;

-- University Programme (single payable package; deposit £2,000 via default)
INSERT INTO public.website_packages
  (programme, key, label, subtitle, duration, full_amount, deposit_amount, deposit_enabled, full_enabled, breakdown, featured, published, sort_order)
VALUES
  ('university', 'programme', 'University Programme', 'Full academic year', 'Sep – May', 18500, NULL, true, true,
   '[{"label":"Tuition","value":"From £18,500"},{"label":"Accommodation","value":"From £5,000"},{"label":"Athletics","value":"£12,000"}]'::jsonb,
   true, true, 0)
ON CONFLICT (programme, key) DO NOTHING;

-- Gap Year packages (display only — deposit/full disabled: no online payment today)
INSERT INTO public.website_packages
  (programme, key, label, subtitle, duration, full_amount, deposit_amount, deposit_enabled, full_enabled, breakdown, featured, published, sort_order)
VALUES
  ('gapyear', 'full-season', 'Full Season', 'Sep – May', 'Full season', 18500, NULL, false, false,
   '[{"label":"Accommodation","value":"£6,500"},{"label":"Athletic fees","value":"£12,000"}]'::jsonb, true, true, 0),
  ('gapyear', 'half-1', 'Half Season', 'Sep – Dec', 'Half season', 10000, NULL, false, false,
   '[{"label":"Accommodation","value":"£6,500"},{"label":"Athletic fees","value":"£3,500"}]'::jsonb, false, true, 1),
  ('gapyear', 'half-2', 'Half Season', 'Jan – May', 'Half season', 10000, NULL, false, false,
   '[{"label":"Accommodation","value":"£6,500"},{"label":"Athletic fees","value":"£3,500"}]'::jsonb, false, true, 2)
ON CONFLICT (programme, key) DO NOTHING;
