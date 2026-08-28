-- Views and leads were two numbers describing the same people.
--
-- The brochure is gated: nobody reaches the pages without giving their details,
-- so every genuine reader is already a known person. Reporting "6 views · 0
-- leads" implied six strangers when it meant one person opening it six times,
-- or opens recorded before we captured identity. What matters is *who* opened
-- it and *how often* — one number, not two.
--
-- Downloads stay separate, because downloading is a different, stronger action
-- than reading — but they are now attributed to a person too, rather than being
-- an anonymous tally.

-- One events table for both actions, so "who did what to this brochure" has a
-- single answer.
alter table public.brochure_views
  add column if not exists kind text not null default 'view';

alter table public.brochure_views drop constraint if exists brochure_views_kind_check;
alter table public.brochure_views
  add constraint brochure_views_kind_check check (kind in ('view', 'download'));

create index if not exists brochure_views_kind_idx on public.brochure_views (brochure_id, kind);

-- Downloads, attributed. Mirrors record_brochure_view: resolve the person,
-- log the event, bump the counter, and make sure they are on the brochure's
-- lead list.
create or replace function public.record_brochure_download(
  p_slug       text,
  p_email      text default null,
  p_referrer   text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brochure_id uuid;
  v_contact_id  uuid;
  v_email       text := nullif(btrim(coalesce(p_email, '')), '');
begin
  select id into v_brochure_id from website_brochures where slug = p_slug;
  if v_brochure_id is null then
    return;
  end if;

  if v_email is not null then
    select id into v_contact_id from contacts where lower(email) = lower(v_email) limit 1;
  end if;

  insert into brochure_views (brochure_id, contact_id, email, referrer, user_agent, kind)
  values (v_brochure_id, v_contact_id, v_email, p_referrer, p_user_agent, 'download');

  update website_brochures
    set download_count = download_count + 1
    where id = v_brochure_id;

  if v_contact_id is not null then
    insert into brochure_leads (brochure_id, contact_id)
    values (v_brochure_id, v_contact_id)
    on conflict (brochure_id, contact_id) do nothing;
  end if;
end;
$$;

revoke all on function public.record_brochure_download(text, text, text, text) from public, anon;
grant execute on function public.record_brochure_download(text, text, text, text) to service_role;

-- The audience for a brochure: one row per person, with how many times they
-- opened it and whether they downloaded. This is what the UI shows instead of
-- a views tally next to a leads tally.
--
-- brochure_leads is the spine so that someone captured by the gate appears
-- immediately, even before their first view row lands.
create or replace function public.brochure_audience(p_brochure_id uuid)
returns table (
  contact_id uuid,
  first_name text,
  last_name  text,
  email      text,
  opens      bigint,
  downloads  bigint,
  first_seen timestamptz,
  last_seen  timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with people as (
    select bl.contact_id, bl.created_at as captured_at
    from brochure_leads bl
    where bl.brochure_id = p_brochure_id
  ),
  events as (
    select bv.contact_id,
           count(*) filter (where bv.kind = 'view')     as opens,
           count(*) filter (where bv.kind = 'download') as downloads,
           min(bv.viewed_at) as first_seen,
           max(bv.viewed_at) as last_seen
    from brochure_views bv
    where bv.brochure_id = p_brochure_id and bv.contact_id is not null
    group by bv.contact_id
  )
  select
    c.id,
    c.first_name,
    c.last_name,
    c.email,
    coalesce(e.opens, 0),
    coalesce(e.downloads, 0),
    least(coalesce(e.first_seen, p.captured_at), p.captured_at),
    greatest(coalesce(e.last_seen, p.captured_at), p.captured_at)
  from people p
  join contacts c on c.id = p.contact_id
  left join events e on e.contact_id = p.contact_id
  order by greatest(coalesce(e.last_seen, p.captured_at), p.captured_at) desc;
$$;

grant execute on function public.brochure_audience(uuid) to authenticated, service_role;

comment on function public.brochure_audience is
  'One row per person who has opened a brochure, with their open and download counts. Replaces the separate views/leads tallies.';
