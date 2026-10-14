-- Hand a brochure to exactly one renderer.
--
-- The cron fires every minute; a 44-page brochure takes about 90 seconds. So
-- runs overlap, and "find a pending row, then mark it rendering" in two steps
-- lets two runs pick the same brochure and upload two sets of page images.
--
-- FOR UPDATE SKIP LOCKED is the standard answer: the second caller steps over
-- the row the first is holding rather than waiting for it, so overlapping runs
-- take different work instead of the same work or no work.

create or replace function public.claim_brochure_render(p_stale_after interval default '10 minutes')
returns setof website_brochures
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  select id into target
  from website_brochures
  where pdf_url is not null
    and (
      render_status = 'pending'
      -- A run that died mid-render leaves its claim behind. After the stale
      -- window the brochure is fair game again, which is what stops one crash
      -- parking a brochure in 'rendering' forever.
      or (render_status = 'rendering'
          and (render_started_at is null or render_started_at < now() - p_stale_after))
    )
    and render_attempts < 3
  order by created_at
  limit 1
  for update skip locked;

  if target is null then
    return;
  end if;

  return query
  update website_brochures
  set render_status   = 'rendering',
      render_started_at = now(),
      render_attempts = render_attempts + 1,
      render_error    = null
  where id = target
  returning *;
end $$;

revoke all on function public.claim_brochure_render(interval) from public, anon, authenticated;
grant execute on function public.claim_brochure_render(interval) to service_role;

comment on function public.claim_brochure_render(interval) is
  'Atomically hands the oldest brochure needing page images to one caller. Service role only — the renderer runs as a cron, never as a signed-in user.';
