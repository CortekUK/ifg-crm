-- Gap Year bills its published deposit, like Residency and University already do.
--
-- 194 and 195 moved the other two programmes onto the deposit published under
-- Website → Pricing. Gap Year was deliberately skipped, because it publishes
-- TWO deposits and SQL cannot know which one a given player owes:
--
--   Full-season  £6,500   featured, sort_order 0
--   Half-1       £4,000
--
-- There is still no package or season column on `deals`, so this cannot be
-- decided per lead. It is decided per pipeline instead, which is what the
-- automation editor's package picker now exposes.
--
-- WHY FULL SEASON
--
-- It is the CMS's own primary package — `featured = true`, `sort_order = 0` —
-- and it is what Gap Year players actually pay on the website:
--
--   £6,735.96  (£6,500 + card fee)   5 paid, 1 sent, 1 cancelled
--   £4,145.29  (£4,000 + card fee)   1 paid, 3 sent, 1 cancelled
--
-- A half-season player therefore gets invoiced £2,500 too much until someone
-- corrects their invoice by hand. That is the trade the single-pipeline setup
-- forces: UK GAP 2027 holds both seasons, and one automation can only name one
-- price. The lasting fix is either a season field on the deal or a separate
-- pipeline per season — a product decision, not a data one.
--
-- Reversible: open UK-GAP invoice generation and change "Which package?", or
-- set Amount Source back to "Fixed custom amount" to restore the old £600.
-- `invoice_amount_custom` is left untouched as the fallback.
--
-- NOTE: the invoice half does not take effect until process-automations is
-- redeployed. The deployed v93 reads only website_pricing_settings, where
-- gapyear's deposit is null and disabled, so it will keep falling back to the
-- custom amount until the build that reads website_packages ships. Deal
-- creation runs in the Next.js app and takes effect on the next web deploy.
--
-- Idempotent: rows already on this configuration are skipped.

-- 1. The invoice automation — what a lead dragged to Send Invoice is billed.
UPDATE automations a
SET config = COALESCE(a.config, '{}'::jsonb)
             || jsonb_build_object(
                  'invoice_amount_source', 'programme_deposit',
                  'invoice_package_key', 'Full-season'
                )
FROM pipelines p
WHERE p.id = a.pipeline_id
  AND p.name ILIKE 'UK GAP%'
  AND EXISTS (
    SELECT 1 FROM automation_steps s
     WHERE s.automation_id = a.id AND s.step_type = 'create_invoice'
  )
  AND (
    COALESCE(a.config->>'invoice_amount_source', '') <> 'programme_deposit'
    OR COALESCE(a.config->>'invoice_package_key', '') <> 'Full-season'
  );

-- 2. The deal-creation automations — what a new Gap Year deal is worth, so the
--    pair stays consistent with the other two programmes.
UPDATE automations a
SET config = COALESCE(a.config, '{}'::jsonb)
             || jsonb_build_object(
                  'deal_value_source', 'programme_deposit',
                  'deal_value_package_key', 'Full-season'
                )
WHERE a.trigger_type = 'form_submission'
  AND a.config->>'form_id' = 'gapyear'
  AND (
    COALESCE(a.config->>'deal_value_source', '') <> 'programme_deposit'
    OR COALESCE(a.config->>'deal_value_package_key', '') <> 'Full-season'
  );
