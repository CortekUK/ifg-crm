-- Expand the allowed tag categories so the automatic lead-routing engine
-- (lib/forms/lead-routing.ts) can tag leads by gender, graduation year,
-- programme and football position — in addition to the existing categories.
--
-- Without this, inserts of the new categories were silently rejected by the
-- old CHECK constraint (assignTag swallows the error), so only 'location'
-- tags were landing on website leads.

ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_category_check;

ALTER TABLE tags ADD CONSTRAINT tags_category_check CHECK (
  category = ANY (ARRAY[
    'tournament'::text,
    'skill'::text,
    'priority'::text,
    'location'::text,
    'source'::text,
    'other'::text,
    'gender'::text,
    'year'::text,
    'programme'::text,
    'position'::text
  ])
);
