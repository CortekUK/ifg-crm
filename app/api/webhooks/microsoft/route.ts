import { NextRequest, NextResponse, after } from 'next/server'
import { getServiceClient, findBySubscriptionId } from '@/lib/outlook/credentials'
import { fetchMessage } from '@/lib/outlook/sync'
import { ingestMessage } from '@/lib/outlook/ingest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// The response goes out in milliseconds; this is the budget for the work that
// carries on afterwards. One message means a Graph fetch and an OpenAI call,
// and Graph batches notifications, so the default would cut a busy batch off
// part-way.
export const maxDuration = 60

/**
 * Microsoft Graph change notifications: new mail in a connected mailbox.
 *
 * TWO THINGS MICROSOFT INSISTS ON, both of which fail silently if missed:
 *
 * 1. THE VALIDATION HANDSHAKE. When a subscription is created, Graph
 *    immediately GETs/POSTs this URL with ?validationToken=... and expects the
 *    token echoed back as text/plain within 10 SECONDS. Miss it and the
 *    subscription is never created — mail simply never arrives, with nothing
 *    anywhere saying why. It is answered first, before any other work.
 *
 * 2. A FAST 2xx. Graph retries anything slow or failing, and repeated failures
 *    kill the subscription. So this route acknowledges immediately and does
 *    the fetching afterwards; a notification is only a nudge, and anything
 *    dropped is picked up by the delta sweep regardless.
 */

interface Notification {
  subscriptionId?: string
  clientState?: string
  resourceData?: { id?: string }
}

function validationResponse(token: string) {
  // Must be text/plain and the raw token — a JSON body is rejected.
  return new NextResponse(token, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('validationToken')
  if (token) return validationResponse(token)
  return NextResponse.json({ status: 'ok', endpoint: 'microsoft-graph-notifications' })
}

export async function POST(request: NextRequest) {
  // Handshake first. Graph sends the token as a query parameter even on POST.
  const validationToken = request.nextUrl.searchParams.get('validationToken')
  if (validationToken) return validationResponse(validationToken)

  let payload: { value?: Notification[] }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const expectedClientState = process.env.MICROSOFT_WEBHOOK_CLIENT_STATE || ''
  const supabase = getServiceClient()
  if (!supabase) {
    // Still 202: a configuration problem on our side must not make Graph tear
    // the subscription down. The sweep will catch up once it is fixed.
    console.error('outlook webhook: service client unavailable')
    return new NextResponse(null, { status: 202 })
  }

  // Everything cheap happens before the acknowledgement; everything that
  // talks to Graph, OpenAI or the database happens after it.
  const wanted = (payload.value ?? []).filter((notification) => {
    // clientState is the only thing proving this came from our subscription
    // and not from anyone who guessed the URL. A mismatch is dropped silently.
    if (expectedClientState && notification.clientState !== expectedClientState) {
      console.warn('outlook webhook: clientState mismatch, ignoring notification')
      return false
    }
    return !!notification.subscriptionId && !!notification.resourceData?.id
  })

  // after() runs once the response has been sent, with the function kept
  // alive until it finishes. Doing this work inline was the whole problem:
  // fetching the message and classifying its intent takes seconds, Graph
  // expects an answer in about three, and a notification endpoint that keeps
  // Graph waiting gets retried and eventually unsubscribed.
  if (wanted.length) {
    after(async () => {
      for (const notification of wanted) {
        try {
          const found = await findBySubscriptionId(supabase, notification.subscriptionId!)
          if (!found?.credentials.mailbox_email) continue

          const message = await fetchMessage(
            supabase,
            found.credentials,
            notification.resourceData!.id!,
          )
          if (!message) continue

          await ingestMessage(
            supabase,
            {
              userId: found.credentials.user_id,
              mailboxEmail: found.credentials.mailbox_email,
            },
            message,
          )
        } catch (err) {
          // Nothing to report to Graph — it has already been thanked. A message
          // lost here is collected by the delta sweep within the hour.
          console.error('outlook webhook: failed to process notification', err)
        }
      }
    })
  }

  return new NextResponse(null, { status: 202 })
}
