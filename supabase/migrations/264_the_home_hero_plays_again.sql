-- The home hero went blank because a YouTube share link was pasted into the
-- CMS "Background video URLs" field on 19 Oct 2026 at 10:51 UTC:
--
--   hero.videos = ["https://youtu.be/bhh_AXuENnM?si=Ct3CB8bFFNGYDlAR"]
--
-- HeroReel assigns each entry to <video>.src, and a <video> element cannot
-- play a YouTube watch page — it fails silently, so the hero showed nothing.
-- Worse, mergePage REPLACES arrays rather than merging them, so that one
-- unplayable link displaced all six self-hosted clips.
--
-- The paste was a fair reading of the field, which only said "Full mp4 URLs".
-- The field's hint is now explicit and HeroReel drops anything that is not a
-- playable media file, so a link like this costs one clip instead of the reel.
--
-- Dropping the override restores the bundled default (the six /hero/*.mp4
-- clips). The old value is kept below so it can be put back if it was meant
-- for something else.
create table if not exists discarded_hero_override_264 as
select slug, overrides->'hero'->'videos' as videos_override, updated_at, now() as backed_up_at
from website_pages
where slug = 'home' and overrides->'hero' ? 'videos';

update website_pages
set overrides = jsonb_set(overrides, '{hero}', (overrides->'hero') - 'videos')
where slug = 'home' and overrides->'hero' ? 'videos';
