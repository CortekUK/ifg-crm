-- Migration 157: store pre-rendered page images for brochures.
-- The CMS renders each PDF page to a small WebP at upload time and stores the
-- ordered public URLs here. The website viewer then loads these images directly
-- (fast, progressive) instead of downloading + rendering the whole PDF. Falls
-- back to client-side PDF rendering when this is empty (older brochures).

alter table public.website_brochures
  add column if not exists page_images jsonb not null default '[]'::jsonb;
