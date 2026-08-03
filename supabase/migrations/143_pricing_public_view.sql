-- ============================================================================
-- Migration 143: public deposit projection for the website
-- ============================================================================
-- The website needs to DISPLAY the deposit figure (e.g. "£2,000 deposit"), but
-- website_pricing_settings is admin-only (it also holds the card-fee internals).
-- This view exposes ONLY the non-sensitive deposit fields to anon, so the price
-- display and the checkout charge share one source. Fee rate/fixed stay private.
-- security_invoker = false: the view reads its base table as the (privileged)
-- owner, so anon sees the projected columns without a base-table SELECT policy.
-- ============================================================================

CREATE OR REPLACE VIEW public.website_pricing_public
WITH (security_invoker = false) AS
  SELECT programme, deposit_default, deposit_enabled, currency
  FROM public.website_pricing_settings;

GRANT SELECT ON public.website_pricing_public TO anon, authenticated;

COMMENT ON VIEW public.website_pricing_public IS 'Public, non-sensitive projection of deposit pricing for the website (no fee internals).';
