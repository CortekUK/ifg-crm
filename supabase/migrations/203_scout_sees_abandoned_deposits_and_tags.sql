-- Scout could not answer two questions because the data was not on its surface.
--
-- QA-37 Bug 1 — "Show me abandoned deposits" → Scout invented a meaning and
-- answered "there are none", when there are 17. The glossary explains exactly
-- what an abandoned deposit is and tells Scout to read the invoices table
-- directly — but execute_readonly_sql is restricted to the v_scout_* views, so
-- that instruction was impossible to follow. The flag it needs
-- (stripe_checkout_session_id) was never exposed. Rather than widen the SQL
-- allow-list to a base table, the view now carries the answer.
--
-- QA-37 Bug 2 — "Which contacts have their parent's email as their main email?"
-- → Scout said 10; the Parent Email tag is on 2,254 contacts. Scout had no way
-- to see tags at all, so it tried to work it out by comparing email fields over
-- a sample and gave a confident wrong number. A tag view makes it answerable.
--
-- Both are additive: no existing column changes, so nothing that reads these
-- views today behaves differently.

-- 1. is_abandoned_deposit on the invoice view.
--    Abandoned = a Stripe page really was opened (session id present), it was a
--    deposit or full payment, and it is still unpaid. 'draft' counts because a
--    website checkout only becomes 'sent' once its payment-link email is
--    confirmed, and a drop-off whose email bounced is still a drop-off.
CREATE OR REPLACE VIEW v_scout_invoices AS
SELECT
  i.id,
  i.invoice_number,
  i.contact_id,
  c.first_name AS contact_first_name,
  c.last_name AS contact_last_name,
  (c.first_name || ' '::text) || c.last_name AS contact_name,
  c.email AS contact_email,
  i.deal_id,
  d.title AS deal_title,
  d.pipeline_id,
  pl.name AS pipeline_name,
  i.type AS invoice_type,
  i.description,
  i.amount,
  i.currency,
  i.status,
  i.payment_method,
  i.recipient_type,
  i.due_date,
  i.sent_at,
  i.paid_at,
  i.created_at,
  i.updated_at,
  CASE
    WHEN i.paid_at IS NOT NULL THEN 0
    WHEN i.due_date IS NULL THEN NULL::integer
    WHEN i.due_date < CURRENT_DATE THEN CURRENT_DATE - i.due_date
    ELSE 0
  END AS days_overdue,
  i.created_by_id,
  creator.full_name AS created_by_name,
  -- Appended last on purpose: CREATE OR REPLACE VIEW can only ADD columns at
  -- the end, it cannot renumber existing ones.
  (
    i.stripe_checkout_session_id IS NOT NULL
    AND i.type = ANY (ARRAY['deposit'::text, 'full_payment'::text])
    AND i.status = ANY (ARRAY['draft'::text, 'sent'::text, 'overdue'::text])
  ) AS is_abandoned_deposit
FROM invoices i
  LEFT JOIN contacts c ON c.id = i.contact_id
  LEFT JOIN deals d ON d.id = i.deal_id
  LEFT JOIN pipelines pl ON pl.id = d.pipeline_id
  LEFT JOIN profiles creator ON creator.id = i.created_by_id;

-- 2. A tag surface. One row per contact per tag, with the contact's name and
--    email so Scout can answer "who" as well as "how many" without a join back
--    to a base table.
CREATE OR REPLACE VIEW v_scout_contact_tags AS
SELECT
  ct.contact_id,
  (c.first_name || ' '::text) || c.last_name AS contact_name,
  c.email AS contact_email,
  t.id   AS tag_id,
  t.name AS tag_name,
  t.category AS tag_category
FROM contact_tags ct
  JOIN tags t ON t.id = ct.tag_id
  LEFT JOIN contacts c ON c.id = ct.contact_id;

GRANT SELECT ON v_scout_invoices TO authenticated, service_role;
GRANT SELECT ON v_scout_contact_tags TO authenticated, service_role;
