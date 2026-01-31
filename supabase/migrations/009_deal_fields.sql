-- Migration: Add additional deal fields
-- Adds win_probability, forecasted_close_date, and description to deals table

-- Add new columns to deals table
ALTER TABLE deals ADD COLUMN IF NOT EXISTS win_probability INTEGER CHECK (win_probability >= 0 AND win_probability <= 100);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS forecasted_close_date DATE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS description TEXT;

-- Add comments for documentation
COMMENT ON COLUMN deals.win_probability IS 'Estimated probability of winning the deal (0-100%)';
COMMENT ON COLUMN deals.forecasted_close_date IS 'Expected date when the deal will close';
COMMENT ON COLUMN deals.description IS 'Additional notes and description for the deal';

-- Create index for forecasted_close_date (useful for filtering/sorting deals by expected close)
CREATE INDEX IF NOT EXISTS idx_deals_forecasted_close_date ON deals(forecasted_close_date) WHERE forecasted_close_date IS NOT NULL;

-- Create index for win_probability (useful for filtering high-probability deals)
CREATE INDEX IF NOT EXISTS idx_deals_win_probability ON deals(win_probability) WHERE win_probability IS NOT NULL;
