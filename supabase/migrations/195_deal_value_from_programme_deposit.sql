-- A new deal is worth the programme's deposit, not a number typed into the
-- automation.
--
-- The client's rule, in their words: "the default value we need to set should
-- be the initial deposit for this program". Today the five live deal-creation
-- automations carry this instead:
--
--   SUMMER RESIDENCY 2027                  default_deal_value £100
--   Test Automation UK Gap Year            (none) → £0
--   UK Gap 2027 Deal Creation              (none) → £0
--   UK Gap Year Deal Automation (testing)  default_deal_value £100
--   University Program 2027                (none) → £0
--
-- So most new leads arrive on the board worth £0 and the rest worth £100,
-- while the website charges the same player £2,000. That also breaks the pair
-- the client described: the invoice automation can bill "deal value" and
-- inherit whatever deal creation chose, which is worth nothing while the deal
-- is created at zero.
--
-- WHAT THIS DOES NOT DO
--
-- It sets `deal_value_source = 'programme_deposit'` only where the programme
-- resolves to EXACTLY ONE published deposit, worked out by the same route the
-- application uses (form_id → programme → published pricing). Consequences,
-- all deliberate:
--
--   * Gap Year is NOT set. It publishes two deposits (£6,500 full season,
--     £4,000 half) and nothing on a form submission says which season the
--     player is applying for, so SQL cannot choose. An admin picks the package
--     in the automation editor, which now lists both with their amounts.
--   * `default_deal_value` is left untouched. It becomes the fallback used
--     only while a published price cannot be resolved, and setting the source
--     back to 'custom' restores exactly today's behaviour.
--   * Existing deals are not re-valued. Changing what a lead recorded months
--     ago was worth would rewrite pipeline totals and reporting history for no
--     one's benefit; this governs deals created from now on.
--
-- Idempotent: rows already on 'programme_deposit' are skipped.

WITH form_map(form_id, programme) AS (
  -- MIRROR: PAYMENT_PROGRAMMES[*].formId in lib/payments/programmes.ts.
  VALUES ('summer', 'residency'), ('university', 'university'), ('gapyear', 'gapyear')
),

-- The deposit each programme publishes: the programme-wide figure first, then
-- a per-package one, but only where every published package agrees. The
-- COUNT(DISTINCT) = 1 test is what keeps Gap Year's two seasons out.
programme_deposit AS (
  SELECT fm.programme,
         COALESCE(
           (SELECT s.deposit_default
              FROM website_pricing_settings s
             WHERE s.programme = fm.programme
               AND s.deposit_enabled
               AND s.deposit_default > 0),
           (SELECT MIN(k.deposit_amount)
              FROM website_packages k
             WHERE k.programme = fm.programme
               AND k.published
               AND k.deposit_enabled
               AND k.deposit_amount > 0
            HAVING COUNT(DISTINCT k.deposit_amount) = 1)
         ) AS deposit
  FROM form_map fm
)

UPDATE automations a
SET config = COALESCE(a.config, '{}'::jsonb)
             || jsonb_build_object('deal_value_source', 'programme_deposit')
FROM form_map fm
JOIN programme_deposit pd ON pd.programme = fm.programme
WHERE a.trigger_type = 'form_submission'
  AND a.config->>'form_id' = fm.form_id
  AND pd.deposit IS NOT NULL
  AND COALESCE(a.config->>'deal_value_source', '') <> 'programme_deposit';
