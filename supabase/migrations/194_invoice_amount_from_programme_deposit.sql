-- Send Invoice should bill the programme's deposit, not a re-typed amount.
--
-- c679782 added `invoice_amount_source = 'programme_deposit'` and made it the
-- default in the builder, but only for automations created or re-saved AFTER
-- it. The five that already existed kept their saved 'custom' setting, so the
-- behaviour never changed and QA-08 is still reproducing:
--
--   Summer Residency Invoice Creation   custom  £100   should be £2,000
--   UK-GAP invoice generation           custom  £600   should be £6,500/£4,000
--   UCLAN 2026 invoice generation       custom  £100   (no pipeline)
--   UK Gap 2026 Invoice generation      custom  £100   (no pipeline)
--   QA Invoice Generation (inactive)    custom  £100   should be £2,000
--
-- Meanwhile the website checkout was charging the real deposit the whole time,
-- so the same player could be invoiced £100 by a recruiter and £2,072.75 by
-- the website. One deposit, two sources of truth — exactly what CMS_PLAN.md
-- warned about.
--
-- WHAT THIS DOES NOT DO
--
-- It does not flip every invoice automation. It flips only those whose
-- programme resolves to EXACTLY ONE published deposit, worked out in SQL by
-- the same route the engine uses at runtime (pipeline → active form-submission
-- automation → form id → programme → published pricing). Three consequences,
-- all deliberate:
--
--   * Gap Year is NOT flipped. It publishes two deposits (£6,500 full season,
--     £4,000 half) and there is no package or season column on `deals`, so
--     nothing says which one a given player owes. Billing either would be
--     wrong half the time. It keeps its hand-set amount until the client
--     decides how a season is chosen — a product decision, not a data fix.
--   * The two automations with a NULL pipeline_id are NOT flipped. Nothing
--     ties them to a programme, so there is no deposit to resolve.
--   * Because the selection is computed rather than hardcoded, re-running this
--     after the client publishes a single Gap Year deposit (or after a package
--     is recorded on the deal) picks it up with no edit here.
--
-- Reversible: `invoice_amount_custom` is left untouched, so setting the source
-- back to 'custom' restores the previous behaviour exactly.
--
-- Idempotent: rows already on 'programme_deposit' are skipped.

WITH form_map(form_id, programme) AS (
  -- MIRROR: PAYMENT_PROGRAMMES[*].formId in lib/payments/programmes.ts, and
  -- FORM_ID_TO_PROGRAMME in process-automations. Change all three together.
  VALUES ('summer', 'residency'), ('university', 'university'), ('gapyear', 'gapyear')
),

-- Every form id each active form-submission automation listens for. The id
-- lives in `form_id` on older rows and `form_ids` (an array) on newer ones.
pipeline_forms AS (
  SELECT f.pipeline_id,
         COALESCE(elem.value, f.config->>'form_id') AS form_id
  FROM automations f
  LEFT JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(f.config->'form_ids') = 'array'
         THEN f.config->'form_ids' ELSE '[]'::jsonb END
  ) AS elem(value) ON TRUE
  WHERE f.trigger_type = 'form_submission'
    AND f.is_active
    AND f.pipeline_id IS NOT NULL
),

pipeline_programme AS (
  SELECT DISTINCT pf.pipeline_id, fm.programme
  FROM pipeline_forms pf
  JOIN form_map fm ON fm.form_id = pf.form_id
),

-- The programme-wide deposit first; failing that, a per-package one, but only
-- when every published package agrees on the figure. COUNT(DISTINCT) = 1 is
-- what keeps Gap Year out.
programme_deposit AS (
  SELECT p.programme,
         COALESCE(
           (SELECT s.deposit_default
              FROM website_pricing_settings s
             WHERE s.programme = p.programme
               AND s.deposit_enabled
               AND s.deposit_default > 0),
           (SELECT MIN(k.deposit_amount)
              FROM website_packages k
             WHERE k.programme = p.programme
               AND k.published
               AND k.deposit_enabled
               AND k.deposit_amount > 0
            HAVING COUNT(DISTINCT k.deposit_amount) = 1)
         ) AS deposit
  FROM (SELECT DISTINCT programme FROM pipeline_programme) p
)

UPDATE automations a
SET config = COALESCE(a.config, '{}'::jsonb)
             || jsonb_build_object('invoice_amount_source', 'programme_deposit')
FROM pipeline_programme pp
JOIN programme_deposit pd ON pd.programme = pp.programme
WHERE a.pipeline_id = pp.pipeline_id
  AND pd.deposit IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM automation_steps s
     WHERE s.automation_id = a.id AND s.step_type = 'create_invoice'
  )
  AND COALESCE(a.config->>'invoice_amount_source', '') <> 'programme_deposit';
