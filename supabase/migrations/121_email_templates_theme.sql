-- Add a per-template theme blob — drives the colours of the parts of
-- the email that sit OUTSIDE the block tree (header strip, footer
-- strip, page background, card background). Stored as JSONB so we
-- can extend it without further migrations as more theme knobs are
-- introduced.
--
-- All keys inside the JSON are optional; when missing the renderer
-- falls back to the IFG defaults (`#0f172a` header, `#f3f4f6` footer,
-- etc.) so existing rows keep their current look without an update.

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS theme JSONB;

COMMENT ON COLUMN public.email_templates.theme IS
  'Optional per-template theme overrides for header/footer/page chrome (TemplateTheme shape). NULL = use defaults.';
