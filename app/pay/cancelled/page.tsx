import { XCircle } from 'lucide-react'
import { resolveInvoice, formatMoney } from '../_lib/resolve'

/**
 * Where Stripe sends a customer who backs out of an emailed invoice payment.
 *
 * Public for the same reason as /pay/success — the audience has no CRM
 * account. The invoice is untouched, so the original "Pay Now" link still
 * works and is offered again here.
 */
export const dynamic = 'force-dynamic'

export default async function PayCancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ invoice_id?: string; session_id?: string }>
}) {
  const { invoice_id, session_id } = await searchParams
  const invoice = await resolveInvoice({ sessionId: session_id, invoiceId: invoice_id })

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
          <XCircle className="h-8 w-8 text-slate-500" />
        </div>
        <h1 className="mb-2 text-xl font-bold text-slate-900">Payment cancelled</h1>
        <p className="mb-6 text-sm text-slate-500">
          Nothing has been charged.
          {invoice ? ` Invoice ${invoice.invoiceNumber} is still outstanding.` : ''}
        </p>

        {invoice && (
          <p className="mb-6 text-sm text-slate-900">
            Amount due: <strong>{formatMoney(invoice.amount, invoice.currency)}</strong>
          </p>
        )}

        {invoice_id && (
          <a
            href={`/pay/${invoice_id}`}
            className="mb-6 inline-block rounded-lg bg-blue-600 px-8 py-3 text-sm font-bold text-white hover:bg-blue-700"
          >
            Try again
          </a>
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
