import { CheckCircle2, Clock } from 'lucide-react'
import { resolveInvoice, formatMoney } from '../_lib/resolve'

/**
 * Where Stripe sends a customer after an emailed invoice is paid.
 *
 * This used to be /portal/payments/success, which sits inside the
 * player-portal layout and is auth-gated — so a parent who paid from a link in
 * an email was bounced to /portal/login the moment Stripe returned them, with
 * no confirmation that their money had gone through. The payment page itself
 * was fixed for logged-out visitors; the page they get sent back to was not.
 *
 * Deliberately has no CRM chrome and no links into the app: the audience is
 * someone who has just paid and has no account.
 */
export const dynamic = 'force-dynamic'

export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; invoice_id?: string }>
}) {
  const { session_id, invoice_id } = await searchParams
  const invoice = await resolveInvoice({ sessionId: session_id, invoiceId: invoice_id })

  // The webhook marks the invoice paid, and it can land a moment after Stripe
  // redirects. Say so plainly rather than showing a scary "unpaid".
  const settled = invoice?.status === 'paid'

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="mb-2 text-xl font-bold text-slate-900">Payment received</h1>
        <p className="mb-6 text-sm text-slate-500">
          Thank you — your payment has gone through. A confirmation email is on its way.
        </p>

        {invoice && (
          <dl className="mb-6 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Invoice</dt>
              <dd className="font-medium text-slate-900">{invoice.invoiceNumber}</dd>
            </div>
            {invoice.description && (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">For</dt>
                <dd className="text-right text-slate-900">{invoice.description}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <dt className="text-slate-500">Amount paid</dt>
              <dd className="text-base font-bold text-slate-900">
                {formatMoney(invoice.amount, invoice.currency)}
              </dd>
            </div>
          </dl>
        )}

        {!settled && (
          <p className="mb-6 flex items-center justify-center gap-1.5 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            Your receipt is being finalised — this can take a minute.
          </p>
        )}

        <p className="text-xs text-slate-400">
          The International Football Group
          <br />
          Questions? Email info@theinternationalfootballgroup.com
        </p>
      </div>
    </main>
  )
}
