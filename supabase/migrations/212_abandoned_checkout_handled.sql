-- QA-46 Bug 1: no way to clear an abandoned checkout except to fake a payment.
--
-- The Abandoned Checkouts panel only offered "Mark paid". Staff who had
-- chased someone — or decided they were never going to pay — had no way to
-- take the row off the list other than recording a payment that never
-- happened. That inflates revenue, leaves a false "paid" invoice behind, and
-- fires every follow-on step a real payment triggers (the deal moves to
-- Deposit Paid, chasing sequences stop, staff are told money arrived).
--
-- A nullable stamp is enough: the panel hides anything that carries one, and
-- the invoice itself is untouched, so it keeps its real status and can still
-- be paid later if the player comes back.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS abandoned_handled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS abandoned_handled_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN invoices.abandoned_handled_at IS
  'When a staff member marked this abandoned checkout as followed up. Hides it '
  'from the Abandoned Checkouts panel without changing the invoice status.';

COMMENT ON COLUMN invoices.abandoned_handled_by IS
  'Who marked it handled. Null when nobody has.';

-- The panel reads unpaid website/invoice checkouts; this keeps that lookup
-- cheap now that it also filters on the stamp.
CREATE INDEX IF NOT EXISTS invoices_abandoned_unhandled_idx
  ON invoices (created_at DESC)
  WHERE abandoned_handled_at IS NULL
    AND stripe_checkout_session_id IS NOT NULL;
