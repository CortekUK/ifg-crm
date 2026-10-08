/**
 * Browser-side trigger for the follow-on effects of a hand-recorded payment.
 *
 * Marking an invoice paid from the CRM used to stop at the invoice row. The
 * deal move, the end of the chasing sequences and the staff alert all live
 * behind the service-role key, so they run in /api/payments/payment-received
 * and this is how the screen asks for them.
 *
 * Never throws. The money is already recorded by the time this runs, so a
 * failure here must not surface as a failed payment — it is logged and the
 * invoice stays paid.
 */
export async function applyPaymentReceived(
  invoiceId: string,
  method: string,
  extra?: { contactId?: string | null; amount?: number | null },
): Promise<void> {
  try {
    const res = await fetch('/api/payments/payment-received', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId,
        method,
        contactId: extra?.contactId ?? null,
        amount: extra?.amount ?? null,
      }),
    })
    if (!res.ok) {
      console.error('Payment recorded, follow-up steps failed:', res.status, await res.text())
    }
  } catch (err) {
    console.error('Payment recorded, follow-up steps failed:', err)
  }
}
