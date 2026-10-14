import type { SupabaseClient } from '@supabase/supabase-js'
import { notificationUrl } from './config'
import { graphFetch } from './graph'
import { getCredentials, recordSync, type OutlookCredentials } from './credentials'

/**
 * Microsoft Graph change-notification subscriptions.
 *
 * Graph will tell us when mail arrives, but only for about three days at a
 * time. The spec puts this second in "things that will bite", and it is the
 * nastiest failure in the feature: when a subscription lapses, mail simply
 * stops arriving. Nothing errors, no job fails, no alert fires — the inbox
 * just goes quiet and looks like nobody emailed.
 *
 * So: subscriptions are renewed well before expiry by the cron, and the
 * catch-up sweep in sync.ts fills anything missed regardless. Both, never one.
 */

// Graph's ceiling for message subscriptions is 4,230 minutes (just under three
// days). We ask for a little less so a slow clock cannot push the request past
// the limit and have Microsoft reject the whole thing.
const SUBSCRIPTION_MINUTES = 4_200

// Renew anything expiring within this window. Generous on purpose: the cron
// runs hourly, and a subscription that lapses between ticks costs real mail.
const RENEW_WITHIN_MS = 12 * 60 * 60 * 1000

interface GraphSubscription {
  id: string
  expirationDateTime: string
  resource: string
}

const RESOURCES = {
  inbox: "/me/mailFolders('inbox')/messages",
  sentitems: "/me/mailFolders('sentitems')/messages",
} as const

type Folder = keyof typeof RESOURCES

function expiry(): string {
  return new Date(Date.now() + SUBSCRIPTION_MINUTES * 60 * 1000).toISOString()
}

function clientState(): string {
  return process.env.MICROSOFT_WEBHOOK_CLIENT_STATE || ''
}

async function createSubscription(
  supabase: SupabaseClient,
  userId: string,
  folder: Folder,
  url: string,
): Promise<GraphSubscription> {
  return graphFetch<GraphSubscription>(supabase, userId, '/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      changeType: 'created',
      notificationUrl: url,
      resource: RESOURCES[folder],
      expirationDateTime: expiry(),
      // Echoed back on every notification so a forged POST can be rejected.
      clientState: clientState(),
    }),
  })
}

async function renewSubscription(
  supabase: SupabaseClient,
  userId: string,
  subscriptionId: string,
): Promise<GraphSubscription> {
  return graphFetch<GraphSubscription>(supabase, userId, `/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ expirationDateTime: expiry() }),
  })
}

async function deleteSubscription(
  supabase: SupabaseClient,
  userId: string,
  subscriptionId: string,
): Promise<void> {
  try {
    await graphFetch(supabase, userId, `/subscriptions/${subscriptionId}`, { method: 'DELETE' })
  } catch {
    // Already gone, or expired. Nothing to clean up.
  }
}

const FIELDS: Record<Folder, { id: keyof OutlookCredentials; expires: keyof OutlookCredentials }> = {
  inbox: { id: 'inbox_subscription_id', expires: 'inbox_subscription_expires_at' },
  sentitems: { id: 'sent_subscription_id', expires: 'sent_subscription_expires_at' },
}

/**
 * Make sure both folders have a live subscription, creating or renewing as
 * needed. Safe to call repeatedly — that is how the cron uses it.
 *
 * Returns a per-folder summary rather than throwing on a single failure: one
 * recruiter's broken mailbox must not stop the renewal sweep for everyone
 * else, which is exactly how a "renewal job" quietly stops renewing.
 */
export async function ensureSubscriptions(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<Folder, 'created' | 'renewed' | 'ok' | 'skipped' | 'failed'>> {
  const result: Record<string, 'created' | 'renewed' | 'ok' | 'skipped' | 'failed'> = {
    inbox: 'skipped',
    sentitems: 'skipped',
  }

  const url = notificationUrl()
  if (!url) {
    // Local development, or no public URL configured. Microsoft refuses to
    // deliver to localhost, so we rely entirely on the delta sweep.
    return result as Record<Folder, 'created' | 'renewed' | 'ok' | 'skipped' | 'failed'>
  }

  const credentials = await getCredentials(supabase, userId)
  if (!credentials || credentials.status !== 'connected') {
    return result as Record<Folder, 'created' | 'renewed' | 'ok' | 'skipped' | 'failed'>
  }

  for (const folder of Object.keys(RESOURCES) as Folder[]) {
    const fields = FIELDS[folder]
    const existingId = credentials[fields.id] as string | null
    const existingExpiry = credentials[fields.expires] as string | null

    try {
      if (existingId && existingExpiry) {
        const msLeft = new Date(existingExpiry).getTime() - Date.now()
        if (msLeft > RENEW_WITHIN_MS) {
          result[folder] = 'ok'
          continue
        }
        if (msLeft > 0) {
          const renewed = await renewSubscription(supabase, userId, existingId)
          await recordSync(supabase, userId, {
            [fields.expires]: renewed.expirationDateTime,
          } as Partial<OutlookCredentials>)
          result[folder] = 'renewed'
          continue
        }
        // Already lapsed — Graph will not renew a dead subscription, so clear
        // it out and create a fresh one below.
        await deleteSubscription(supabase, userId, existingId)
      }

      const created = await createSubscription(supabase, userId, folder, url)
      await recordSync(supabase, userId, {
        [fields.id]: created.id,
        [fields.expires]: created.expirationDateTime,
      } as Partial<OutlookCredentials>)
      result[folder] = 'created'
    } catch (err) {
      console.error(`outlook: subscription ${folder} failed for ${userId}:`, err)
      result[folder] = 'failed'
    }
  }

  return result as Record<Folder, 'created' | 'renewed' | 'ok' | 'skipped' | 'failed'>
}

/** Drop both subscriptions — used on disconnect so Graph stops posting to us. */
export async function removeSubscriptions(
  supabase: SupabaseClient,
  userId: string,
  credentials: OutlookCredentials,
): Promise<void> {
  for (const id of [credentials.inbox_subscription_id, credentials.sent_subscription_id]) {
    if (id) await deleteSubscription(supabase, userId, id)
  }
}
