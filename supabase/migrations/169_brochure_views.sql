-- Who viewed a brochure, not just how many.
--
-- views_count was a bare counter bumped by increment_brochure_view(slug), so a
-- brochure could report "3 views" with no way to tell whose they were. Meanwhile
-- the gate stores the visitor's details in localStorage and skips itself on
-- return visits — so a repeat viewer generated views and no lead at all. That is
-- how Summer Residency ended up at 3 views / 0 leads.
--
-- A view is now a row. When it can be attributed to a contact the same call also
-- records them as a lead for that brochure, so "viewed it" and "is a lead on it"
-- stop being two disconnected numbers.

create table if not exists public.brochure_views (
  id          uuid primary key default gen_random_uuid(),
  brochure_id uuid not null references public.website_brochures(id) on delete cascade,
  -- Null when an anonymous visitor opens a public link. Set the moment we can
  -- tie the view to somebody.
  contact_id  uuid references public.contacts(id) on delete set null,
  -- Kept even when contact_id is null, so a view can be matched retroactively
  -- once that address becomes a contact.
  email       text,
  referrer    text,
  user_agent  text,
  viewed_at   timestamptz not null default now()
);

create index if not exists brochure_views_brochure_idx on public.brochure_views (brochure_id, viewed_at desc);
create index if not exists brochure_views_contact_idx on public.brochure_views (contact_id) where contact_id is not null;
create index if not exists brochure_views_email_idx   on public.brochure_views (lower(email)) where email is not null;

alter table public.brochure_views enable row level security;

do $$
begin
  drop policy if exists brochure_views_staff_read on public.brochure_views;
  create policy brochure_views_staff_read on public.brochure_views
    for select to authenticated using (public.get_user_role() <> 'player');
end $$;

-- One call from the public tracking endpoint: record the view, bump the
-- counter, resolve the viewer, and promote a known viewer to a lead on this
-- brochure. SECURITY DEFINER because the caller is the service role and this
-- writes across three tables.
create or replace function public.record_brochure_view(
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
    return;  -- unknown slug: nothing to record, and not worth erroring a beacon
  end if;

  -- Case-insensitive: the gate echoes back whatever the visitor typed.
  if v_email is not null then
    select id into v_contact_id
    from contacts
    where lower(email) = lower(v_email)
    limit 1;
  end if;

  insert into brochure_views (brochure_id, contact_id, email, referrer, user_agent)
  values (v_brochure_id, v_contact_id, v_email, p_referrer, p_user_agent);

  update website_brochures
    set views_count = views_count + 1
    where id = v_brochure_id;

  -- A known person opening the brochure IS a lead on it, whether or not they
  -- filled the gate again. This is what makes views and leads one thing.
  if v_contact_id is not null then
    insert into brochure_leads (brochure_id, contact_id)
    values (v_brochure_id, v_contact_id)
    on conflict (brochure_id, contact_id) do nothing;
  end if;
end;
$$;

revoke all on function public.record_brochure_view(text, text, text, text) from public, anon;
grant execute on function public.record_brochure_view(text, text, text, text) to service_role;

-- Backfill: every lead already recorded against a brochure must have opened it,
-- but those views pre-date this table. Seed one row each so the counts reconcile
-- instead of showing leads with no views behind them.
insert into public.brochure_views (brochure_id, contact_id, email, viewed_at)
select bl.brochure_id, bl.contact_id, c.email, bl.created_at
from public.brochure_leads bl
join public.contacts c on c.id = bl.contact_id
on conflict do nothing;
