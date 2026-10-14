-- Rendering a brochure stops depending on an admin keeping a tab open.
--
-- Today the PDF is rasterised to page images in the admin's browser, because
-- doing it server-side appeared to need a native canvas binary. It does not:
-- pdfium compiled to WebAssembly renders a page without any canvas at all.
--
-- Measured on the real files: the 44-page, 157MB University brochure takes 28s
-- to download and 32s to render every page, peaking at 1.1GB. That is one
-- ordinary function invocation, so the work moves to a cron and the admin can
-- close the tab the moment the upload finishes.
--
-- These columns are what the cron claims work with and what the UI reads to
-- show progress. Nothing here changes an existing brochure: every row that
-- already has its images is marked 'ready' and never looked at again.

alter table website_brochures
  add column if not exists render_status text not null default 'ready',
  add column if not exists rendered_pages integer not null default 0,
  add column if not exists render_error text,
  add column if not exists render_attempts integer not null default 0,
  -- When the current attempt claimed the row. A run that dies without
  -- releasing its claim would otherwise block the brochure forever; the worker
  -- treats a claim older than its own time limit as abandoned.
  add column if not exists render_started_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'website_brochures_render_status_check'
  ) then
    alter table website_brochures
      add constraint website_brochures_render_status_check
      check (render_status in ('pending', 'rendering', 'ready', 'failed'));
  end if;
end $$;

-- Existing rows: those that already have images are done. A brochure holding a
-- PDF with no images is work the cron should pick up — which includes every
-- brochure uploaded before pre-rendering existed.
update website_brochures
set render_status = case
      when pdf_url is null then 'ready'
      when page_images is null or jsonb_array_length(page_images) = 0 then 'pending'
      else 'ready'
    end,
    rendered_pages = case
      when page_images is null then 0
      else jsonb_array_length(page_images)
    end;

-- The worker asks one question on every run: what is the oldest brochure
-- needing work? Without this it is a sequential scan each minute.
create index if not exists website_brochures_render_queue_idx
  on website_brochures (render_status, created_at)
  where render_status in ('pending', 'rendering');

comment on column website_brochures.render_status is
  'pending = queued for the renderer, rendering = a run holds it, ready = page images complete, failed = gave up after render_attempts';
