import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'

/**
 * Invoice behind a Stripe return URL, resolved WITHOUT a logged-in user.
 *
 * The people who land on /pay/success are players and parents who followed a
 * "Pay Now" button in an email. Most have no CRM account at all, so anything
 * that needs a session is the wrong tool — this uses the service key and reads
 * only the few fields the confirmation screen prints.
 */
export interface PaidInvoiceSummary {
  invoiceNumber: string
  amount: number
  currency: string
  description: string | null
  status: string
}

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function resolveInvoice(params: {
  sessionId?: string
  invoiceId?: string
}): Promise<PaidInvoiceSummary | null> {
  const supabase = service()
  if (!supabase) return null

  let invoiceId = params.invoiceId ?? null

  // Stripe hands back only the session id, so translate it to our invoice via
  // the metadata every payment route stamps on the session.
  if (!invoiceId && params.sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(params.sessionId)
      invoiceId = session.metadata?.invoice_id ?? null
    } catch {
      return null
    }
  }
  if (!invoiceId) return null

  const { data } = await supabase
    .from('invoices')
    .select('invoice_number, amount, currency, description, status')
    .eq('id', invoiceId)
    .maybeSingle()
  if (!data) return null

  return {
    invoiceNumber: data.invoice_number,
    amount: Number(data.amount),
    currency: data.currency || 'GBP',
    description: data.description,
    status: data.status,
  }
}

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount)
}
