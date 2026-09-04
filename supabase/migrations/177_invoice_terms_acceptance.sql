-- Record what was agreed to, on the invoice, at the moment it was paid.
--
-- Stripe records THAT the customer ticked the box. It does not record which
-- wording they saw, and terms get rewritten. Stamping the programme and
-- version onto the invoice keeps a payment tied to the text that was live
-- when it was made, and keeps the record inside the CRM rather than only in
-- a third party's dashboard.
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS terms_programme   TEXT,
  ADD COLUMN IF NOT EXISTS terms_version     INTEGER,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN invoices.terms_accepted_at IS
  'When Stripe confirmed the customer accepted the Terms & Conditions. NULL means no consent was recorded for this payment.';
