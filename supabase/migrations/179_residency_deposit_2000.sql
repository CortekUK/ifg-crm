-- Summer Residency deposit: £1,000 -> £2,000, all blocks.
-- Requested by Matthew Morgan (Technical Director, Macclesfield FC), 09/09/2026.
--
-- Every residency package has deposit_amount = NULL, i.e. they all inherit the
-- programme default, so this one row covers Blocks A, B and C. The public
-- deposit route reads this value server-side (resolvePricing) and never trusts
-- an amount from the browser, so this is the single source of truth for what
-- Stripe actually charges.
--
-- Existing invoices are deliberately untouched: an invoice already sent to a
-- customer keeps the amount they were quoted.
update website_pricing_settings
   set deposit_default = 2000,
       updated_at = now()
 where programme = 'residency';
