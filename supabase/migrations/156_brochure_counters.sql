-- Migration 156: atomic increment helpers for brochure view/download counters.
-- Called from the secret-guarded public tracking endpoints via the service role.

create or replace function public.increment_brochure_view(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.website_brochures set views_count = views_count + 1 where slug = p_slug;
$$;

create or replace function public.increment_brochure_download(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.website_brochures set download_count = download_count + 1 where slug = p_slug;
$$;

grant execute on function public.increment_brochure_view(text) to service_role;
grant execute on function public.increment_brochure_download(text) to service_role;
