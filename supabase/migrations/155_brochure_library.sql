-- Migration 155: Brochure library revamp
-- Turns website_brochures from one-per-programme into a general library of many
-- brochures, each with a public shareable slug, view/download counters, and
-- many-to-many links to lists, campaigns and pipeline stages, plus per-brochure
-- captured-lead tracking. Programme association becomes optional (kept so the
-- programme pages can still resolve "their" brochure).

-- ── 1. website_brochures: slug + counters, decouple from programme ────────────
alter table public.website_brochures
  add column if not exists slug text,
  add column if not exists views_count integer not null default 0,
  add column if not exists download_count integer not null default 0;

-- Backfill slug for existing rows (from programme, else a slugified title).
update public.website_brochures
  set slug = coalesce(
    slug,
    program,
    regexp_replace(lower(trim(title)), '[^a-z0-9]+', '-', 'g')
  )
  where slug is null;

-- Programme is now an optional association, not the identity.
alter table public.website_brochures drop constraint if exists website_brochures_program_key;
alter table public.website_brochures alter column program drop not null;

alter table public.website_brochures alter column slug set not null;
create unique index if not exists website_brochures_slug_key on public.website_brochures (slug);

-- ── 2. Association tables (many-to-many) ─────────────────────────────────────
create table if not exists public.brochure_lists (
  brochure_id uuid not null references public.website_brochures(id) on delete cascade,
  list_id     uuid not null references public.lists(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (brochure_id, list_id)
);

create table if not exists public.brochure_campaigns (
  brochure_id uuid not null references public.website_brochures(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (brochure_id, campaign_id)
);

-- A brochure can be attached to many pipeline stages; a stage can have many
-- brochures. stage_id NULL = "any/current stage" fallback handled in app logic.
create table if not exists public.brochure_pipelines (
  id          uuid primary key default gen_random_uuid(),
  brochure_id uuid not null references public.website_brochures(id) on delete cascade,
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  stage_id    uuid references public.pipeline_stages(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create unique index if not exists brochure_pipelines_uniq
  on public.brochure_pipelines (brochure_id, pipeline_id, coalesce(stage_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ── 3. Captured leads per brochure ───────────────────────────────────────────
create table if not exists public.brochure_leads (
  brochure_id uuid not null references public.website_brochures(id) on delete cascade,
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (brochure_id, contact_id)
);
create index if not exists brochure_leads_brochure_idx on public.brochure_leads (brochure_id);

-- ── 4. RLS ───────────────────────────────────────────────────────────────────
alter table public.brochure_lists     enable row level security;
alter table public.brochure_campaigns enable row level security;
alter table public.brochure_pipelines enable row level security;
alter table public.brochure_leads     enable row level security;

-- Staff-managed config (content admins manage; other staff can read). No public.
do $$
begin
  -- brochure_lists
  drop policy if exists brochure_lists_admin_all on public.brochure_lists;
  create policy brochure_lists_admin_all on public.brochure_lists
    for all to authenticated using (public.is_content_admin()) with check (public.is_content_admin());
  drop policy if exists brochure_lists_staff_read on public.brochure_lists;
  create policy brochure_lists_staff_read on public.brochure_lists
    for select to authenticated using (public.get_user_role() <> 'player');

  -- brochure_campaigns
  drop policy if exists brochure_campaigns_admin_all on public.brochure_campaigns;
  create policy brochure_campaigns_admin_all on public.brochure_campaigns
    for all to authenticated using (public.is_content_admin()) with check (public.is_content_admin());
  drop policy if exists brochure_campaigns_staff_read on public.brochure_campaigns;
  create policy brochure_campaigns_staff_read on public.brochure_campaigns
    for select to authenticated using (public.get_user_role() <> 'player');

  -- brochure_pipelines
  drop policy if exists brochure_pipelines_admin_all on public.brochure_pipelines;
  create policy brochure_pipelines_admin_all on public.brochure_pipelines
    for all to authenticated using (public.is_content_admin()) with check (public.is_content_admin());
  drop policy if exists brochure_pipelines_staff_read on public.brochure_pipelines;
  create policy brochure_pipelines_staff_read on public.brochure_pipelines
    for select to authenticated using (public.get_user_role() <> 'player');

  -- brochure_leads (staff read; writes via service role only)
  drop policy if exists brochure_leads_staff_read on public.brochure_leads;
  create policy brochure_leads_staff_read on public.brochure_leads
    for select to authenticated using (public.get_user_role() <> 'player');
end $$;
