-- QA-28: a reply to an invoice email arrives with no deal and no pipeline.
--
-- Giving invoice emails the tracked Reply-To got the replies INTO the CRM —
-- they are captured and matched to the right player. But the Replies list
-- showed them with a blank pipeline and they never appeared on the deal, which
-- is the exact thing QA-28 says to watch for ("replies arriving but the
-- pipeline showing as blank — that breaks the stage move in QA-30").
--
-- The reason is that resend-inbound works out the deal and pipeline by walking
-- back from the email_sends row, and it only knew two ways to get there:
--
--   campaign blast    email_sends.campaign_id       -> campaigns.pipeline_id
--   automation drip   email_sends.automation_log_id -> ... -> automations.pipeline_id
--
-- An invoice email is neither. It has no campaign and no automation log, so
-- both lookups returned null and the reply was stored with deal_id = NULL and
-- pipeline_id = NULL.
--
-- The invoice itself already knows the deal, and the deal knows the pipeline.
-- What was missing was the link from the email back to the invoice, so this
-- adds it. Both invoice senders (the Send button in
-- app/api/invoices/[id]/send-with-link and sendInvoicePaymentLinkEmail in
-- supabase/functions/process-automations) now set it, and
-- deriveReplySourceMeta has a third path that uses it.
--
-- ON DELETE SET NULL, not CASCADE: deleting an invoice must not delete the
-- record that the email was sent, nor the player's reply to it.

ALTER TABLE public.email_sends
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.email_sends.invoice_id IS
  'The invoice this email was about, for invoice emails. How a reply to an '
  'invoice finds its deal and pipeline (QA-28) — invoice emails carry neither '
  'a campaign_id nor an automation_log_id.';

-- Partial: only invoice emails have a value, and they are a small minority of
-- a large table. This index serves the inbound reply lookup.
CREATE INDEX IF NOT EXISTS email_sends_invoice_id_idx
  ON public.email_sends (invoice_id)
  WHERE invoice_id IS NOT NULL;
