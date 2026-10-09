import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Write the payments row that a hand "Mark Paid" was leaving out.
 *
 * Mark Paid — in the invoice row menu, the bulk action, the invoice sheet and
 * the Abandoned Deposits list — only ever set `invoices.status = 'paid'`. The
 * invoice looked settled, but no `payments` row existed and `payment_method`
 * stayed blank, so the money was absent from the Payments page and from every
 * total built on it. QA marked IFG-2026-00163 paid and the £1 simply was not
 * anywhere (QA-44 new issue 1). Record Payment inside View did it properly,
 * which is why it went unnoticed.
 *
 * Called from the two hooks every Mark Paid path goes through, rather than
 * from each button — that is what makes it cover all four.
 *
 * Idempotent on purpose: an invoice already carrying a successful payment is
 * left alone, so Record Payment followed by Mark Paid cannot bank the money
 * twice, and neither can a retry.
 *
 * Never throws. The invoice is already paid by the time this runs; a failure
 * here must not present as a failed payment.
 */
/**
 * The two tables do NOT share a vocabulary, and the CHECK constraints differ:
 *
 *   payments.payment_method  stripe | bank_transfer | website | cash | other
 *   invoices.payment_method  stripe | bank_transfer | website | manual
 *
 * So 'manual' is valid on an invoice and rejected on a payment, and 'other' is
 * the reverse. Writing one value to both silently fails the insert and loses
 * the payment all over again. Mark Paid does not ask for a method, so the
 * honest pair is 'other' on the payment and 'manual' on the invoice; a caller
 * that does know (Record Payment) passes a real method instead.
 */
const PAYMENT_METHOD_FALLBACK = 'other'
const INVOICE_METHOD_FALLBACK = 'manual'

/** Methods valid on `payments`, per payments_payment_method_check. */
const PAYMENT_METHODS = new Set(['stripe', 'bank_transfer', 'website', 'cash', 'other'])
/** Methods valid on `invoices`, per invoices_payment_method_check. */
const INVOICE_METHODS = new Set(['stripe', 'bank_transfer', 'website', 'manual'])

export async function recordManualPaymentForInvoice(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  invoiceId: string,
  method?: string,
): Promise<void> {
  try {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, contact_id, amount, payment_method')
      .eq('id', invoiceId)
      .maybeSingle()

    if (!invoice?.contact_id || invoice.amount == null) return

    const { data: existing } = await supabase
      .from('payments')
      .select('id')
      .eq('invoice_id', invoiceId)
      .neq('status', 'failed')
      .limit(1)

    if (existing && existing.length > 0) return

    const { data: { user } } = await supabase.auth.getUser()

    const paymentMethod =
      method && PAYMENT_METHODS.has(method) ? method : PAYMENT_METHOD_FALLBACK
    const invoiceMethod =
      method && INVOICE_METHODS.has(method) ? method : INVOICE_METHOD_FALLBACK

    const { error } = await supabase.from('payments').insert({
      invoice_id: invoiceId,
      contact_id: invoice.contact_id,
      amount: invoice.amount,
      payment_date: new Date().toISOString(),
      payment_method: paymentMethod,
      status: 'successful',
      reference: 'Marked paid in the CRM',
      recorded_by_id: user?.id ?? null,
    })
    if (error) {
      console.error('Invoice marked paid but no payment recorded:', error.message)
      return
    }

    // The invoice's own method field was left blank too, so the Invoices page
    // showed a paid invoice with no method against it.
    if (!invoice.payment_method) {
      await supabase.from('invoices').update({ payment_method: invoiceMethod }).eq('id', invoiceId)
    }
  } catch (err) {
    console.error('Invoice marked paid but no payment recorded:', err)
  }
}
