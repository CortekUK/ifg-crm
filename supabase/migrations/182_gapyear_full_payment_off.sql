-- Gap Year: take deposits only for now. The full-season / half-season totals are
-- shown on the website, but paying them in full online isn't confirmed yet, so the
-- "Payable in full" toggle starts off on every Gap Year package. Switch it back on
-- per package in the CRM (Website Content → Gap Year → edit package) once confirmed.
UPDATE public.website_packages
SET full_enabled = false
WHERE programme = 'gapyear';
