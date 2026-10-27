import type { SupabaseClient } from '@supabase/supabase-js'
import { graphFetch, OutlookReconnectRequired } from './graph'
import { getConnectedMailboxes, recordSync, type OutlookCredentials } from './credentials'
import { ensureSubscriptions } from './subscriptions'
import { ingestMessage } from './ingest'
import { MESSAGE_SELECT, SINGLE_MESSAGE_SELECT, type GraphMessage } from './types'

/**
 * The catch-up sweep.
 *
 * Change notifications get missed — Microsoft drops them, our endpoint has a
 * blip, a subscription lapses before renewal. The spec is explicit that you
 * need BOTH a notification endpoint and a sweep: "without this, mail goes
 * missing occasionally and it is very hard to debug."
 *
 * The sweep uses Graph's delta queries. Each run stores a deltaLink, and the
 * next run asks "what changed since that token", so it stays cheap no matter
 * how large the mailbox is. The very first run has no token and would
 * otherwise walk the entire mailbox, so it is bounded — see INITIAL_WINDOW.
 */

// How far back the FIRST sync reaches. A mailbox can hold years of mail and
// tens of thousands of messages; importing all of it on connect would hammer
// Graph, cost a fortune in intent classification, and bury the inbox in
// history nobody asked for. Later runs are delta-based and unbounded.
const INITIAL_WINDOW_DAYS = 30

// Hard ceiling per folder per run, so one enormous mailbox cannot run the
// serverless function out of time and leave the delta token unsaved.
const MAX_MESSAGES_PER_RUN = 400

const FOLDERS = ['inbox', 'sentitems'] as const
type Folder = (typeof FOLDERS)[number]

const DELTA_FIELD: Record<Folder, keyof OutlookCredentials> = {
  inbox: 'inbox_delta_link',
  sentitems: 'sent_delta_link',
}

interface DeltaResponse {
  value?: GraphMessage[]
  '@odata.nextLink'?: string
  '@odata.deltaLink'?: string
}

export interface SyncSummary {
  mailbox: string
  inserted: number
  duplicates: number
  skipped: number
  errors: string[]
}

function initialDeltaUrl(folder: Folder): string {
  const since = new Date(Date.now() - INITIAL_WINDOW_DAYS * 86_400_000).toISOString()
  // $filter on a delta query is only honoured on the FIRST request; afterwards
  // the token carries the query. That is exactly the shape we want.
  return (
    `/me/mailFolders('${folder}')/messages/delta` +
    `?$select=${MESSAGE_SELECT}` +
    `&$filter=receivedDateTime ge ${since}`
  )
}

async function syncFolder(
  supabase: SupabaseClient,
  credentials: OutlookCredentials,
  folder: Folder,
  summary: SyncSummary,
): Promise<void> {
  const mailboxEmail = credentials.mailbox_email
  if (!mailboxEmail) return

  const stored = credentials[DELTA_FIELD[folder]] as string | null
  let url: string | null = stored || initialDeltaUrl(folder)
  let processed = 0
  let deltaLink: string | null = null

  while (url && processed < MAX_MESSAGES_PER_RUN) {
    const page: DeltaResponse = await graphFetch<DeltaResponse>(
      supabase,
      credentials.user_id,
      url,
      { headers: { Prefer: 'odata.maxpagesize=50' } },
      credentials,
    )

    for (const message of page.value ?? []) {
      // A delta page includes deletions as stubs with no body or sender.
      // Nothing to ingest, and attempting it would insert an empty reply.
      if (!message.id || (!message.from && !message.sender)) continue

      try {
        const result = await ingestMessage(
          supabase,
          { userId: credentials.user_id, mailboxEmail, loadHeaders: headerLoader(supabase, credentials) },
          message,
        )
        if (result.status === 'inserted') summary.inserted++
        else if (result.status === 'duplicate') summary.duplicates++
        else summary.skipped++
      } catch (err) {
        summary.errors.push(err instanceof Error ? err.message : 'ingest failed')
      }
      processed++
    }

    deltaLink = page['@odata.deltaLink'] ?? null
    url = page['@odata.nextLink'] ?? null
    // A deltaLink means we have reached the end of the current change set.
    if (deltaLink) break
  }

  // Save the cursor so the next run resumes here. When we stopped early on the
  // message cap there is no deltaLink yet, so the nextLink is stored instead —
  // the following run continues from exactly where this one left off rather
  // than starting the window again.
  const cursor = deltaLink ?? url
  if (cursor) {
    await recordSync(supabase, credentials.user_id, {
      [DELTA_FIELD[folder]]: cursor,
    } as Partial<OutlookCredentials>)
  }
}

/** Sweep a single mailbox. Never throws — failures are reported, not raised. */
export async function syncMailbox(
  supabase: SupabaseClient,
  credentials: OutlookCredentials,
): Promise<SyncSummary> {
  const summary: SyncSummary = {
    mailbox: credentials.mailbox_email ?? credentials.user_id,
    inserted: 0,
    duplicates: 0,
    skipped: 0,
    errors: [],
  }

  for (const folder of FOLDERS) {
    try {
      await syncFolder(supabase, credentials, folder, summary)
    } catch (err) {
      if (err instanceof OutlookReconnectRequired) {
        // Already marked reconnect_needed by the token layer. Stop touching
        // this mailbox; retrying a dead refresh token achieves nothing.
        summary.errors.push(`${folder}: needs reconnecting`)
        break
      }
      const message = err instanceof Error ? err.message : 'sync failed'
      summary.errors.push(`${folder}: ${message}`)
      // A delta token can be rejected (410 Gone) after long inactivity. Clear
      // it so the next run starts a fresh window instead of failing forever.
      if (message.includes('410') || message.toLowerCase().includes('resync')) {
        await recordSync(supabase, credentials.user_id, {
          [DELTA_FIELD[folder]]: null,
        } as Partial<OutlookCredentials>)
      }
    }
  }

  await recordSync(supabase, credentials.user_id, {
    last_sync_error: summary.errors.length ? summary.errors.join('; ').slice(0, 500) : null,
  })

  return summary
}

/**
 * Sweep every connected mailbox and keep subscriptions alive.
 *
 * One mailbox failing must never stop the others — that is how a renewal job
 * quietly stops renewing for the whole team.
 */
export async function syncAllMailboxes(supabase: SupabaseClient): Promise<SyncSummary[]> {
  const mailboxes = await getConnectedMailboxes(supabase)
  const summaries: SyncSummary[] = []

  for (const credentials of mailboxes) {
    try {
      await ensureSubscriptions(supabase, credentials.user_id)
    } catch (err) {
      console.error('outlook: subscription renewal failed', credentials.mailbox_email, err)
    }
    try {
      summaries.push(await syncMailbox(supabase, credentials))
    } catch (err) {
      summaries.push({
        mailbox: credentials.mailbox_email ?? credentials.user_id,
        inserted: 0,
        duplicates: 0,
        skipped: 0,
        errors: [err instanceof Error ? err.message : 'sync failed'],
      })
    }
  }

  return summaries
}

/** Fetch one message's headers, for the relevance filter. */
export function headerLoader(supabase: SupabaseClient, credentials: OutlookCredentials) {
  return async (graphMessageId: string) => {
    const found = await graphFetch<Pick<GraphMessage, 'internetMessageHeaders'>>(
      supabase,
      credentials.user_id,
      `/me/messages/${graphMessageId}?$select=internetMessageHeaders`,
      {},
      credentials,
    )
    return found.internetMessageHeaders ?? null
  }
}

/** Fetch one message by id — the path a change notification takes. */
export async function fetchMessage(
  supabase: SupabaseClient,
  credentials: OutlookCredentials,
  graphMessageId: string,
): Promise<GraphMessage | null> {
  try {
    return await graphFetch<GraphMessage>(
      supabase,
      credentials.user_id,
      `/me/messages/${graphMessageId}?$select=${SINGLE_MESSAGE_SELECT}`,
      {},
      credentials,
    )
  } catch (err) {
    console.error('outlook: could not fetch message', graphMessageId, err)
    return null
  }
}
