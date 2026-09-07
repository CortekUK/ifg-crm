-- Day-by-day itinerary for a package.
--
-- The Summer Residency is sold as dated blocks, and each block has its own
-- schedule — arrivals, training days, match days, trips, departures. That
-- schedule belongs to the block it describes, so it lives on the package
-- rather than in a table of its own: adding a block adds its itinerary, and
-- deleting one cannot leave an orphan schedule behind.
--
-- Shape: [{ "date": "Monday June 28th", "activity": "Arrivals" }, ...]
-- Empty means the block simply shows no schedule, which is the state every
-- other programme's packages are in.
ALTER TABLE website_packages
  ADD COLUMN IF NOT EXISTS itinerary JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN website_packages.itinerary IS
  'Day-by-day schedule for this block: [{date, activity}]. Edited in the CRM under Website Content → Programme Pricing.';
