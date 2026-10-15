import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { decryptToken, encryptToken } from './crypto'

/**
 * Storage layer for per-user Microsoft connections (table: outlook_credentials).
 *
 * Everything here runs under the SERVICE ROLE and must only ever be called
 * from server code. Tokens are encrypted at rest and are never returned to a
 * browser — the API routes expose connection *status*, never the credentials.
 */

export type OutlookStatus = 'connected' | 'reconnect_needed' | 'disconnected'

export interface OutlookCredentials {
  user_id: string
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  mailbox_email: string | null
  mailbox_display_name: string | null
  graph_user_id: string | null
  status: OutlookStatus
  status_detail: string | null
  inbox_subscription_id: string | null
  inbox_subscription_expires_at: string | null
  sent_subscription_id: string | null
  sent_subscription_expires_at: string | null
  inbox_delta_link: string | null
  sent_delta_link: string | null
  last_synced_at: string | null
  last_sync_error: string | null
  connected_at: string
  updated_at: string
}

/** Decrypted tokens, for internal use only. Never serialise this. */
export interface DecryptedTokens {
  accessToken: string | null
  refreshToken: string | null
  expiresAt: Date | null
}

export function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function getCredentials(
  supabase: SupabaseClient,
  userId: string,
): Promise<OutlookCredentials | null> {
  const { data, error } = await supabase
    .from('outlook_credentials')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.error('outlook: failed to read credentials', error.message)
    return null
  }
  return (data as OutlookCredentials | null) ?? null
}

/** Every mailbox the sync job should touch. */
export async function getConnectedMailboxes(
  supabase: SupabaseClient,
): Promise<OutlookCredentials[]> {
  const { data, error } = await supabase
    .from('outlook_credentials')
    .select('*')
    .eq('status', 'connected')
  if (error) {
    console.error('outlook: failed to list mailboxes', error.message)
    return []
  }
  return (data as OutlookCredentials[]) ?? []
}

/** Find the mailbox a change notification belongs to, by subscription id. */
export async function findBySubscriptionId(
  supabase: SupabaseClient,
  subscriptionId: string,
): Promise<{ credentials: OutlookCredentials; folder: 'inbox' | 'sentitems' } | null> {
  const { data } = await supabase
    .from('outlook_credentials')
    .select('*')
    .or(`inbox_subscription_id.eq.${subscriptionId},sent_subscription_id.eq.${subscriptionId}`)
    .maybeSingle()
  if (!data) return null
  const credentials = data as OutlookCredentials
  return {
    credentials,
    folder: credentials.inbox_subscription_id === subscriptionId ? 'inbox' : 'sentitems',
  }
}

export function decryptCredentials(credentials: OutlookCredentials): DecryptedTokens {
  return {
    accessToken: decryptToken(credentials.access_token),
    refreshToken: decryptToken(credentials.refresh_token),
    expiresAt: credentials.token_expires_at ? new Date(credentials.token_expires_at) : null,
  }
}

export async function saveTokens(
  supabase: SupabaseClient,
  userId: string,
  tokens: { accessToken: string; refreshToken?: string | null; expiresInSeconds: number },
  extra: Partial<
    Pick<OutlookCredentials, 'mailbox_email' | 'mailbox_display_name' | 'graph_user_id'>
  > = {},
): Promise<void> {
  const payload: Record<string, unknown> = {
    user_id: userId,
    access_token: encryptToken(tokens.accessToken),
    // Microsoft does not always reissue a refresh token on refresh. Writing
    // an undefined here would blank the only credential that can recover the
    // connection, so the existing value is left alone unless a new one came.
    token_expires_at: new Date(Date.now() + tokens.expiresInSeconds * 1000).toISOString(),
    status: 'connected',
    status_detail: null,
    ...extra,
  }
  if (tokens.refreshToken) payload.refresh_token = encryptToken(tokens.refreshToken)

  const { error } = await supabase
    .from('outlook_credentials')
    .upsert(payload, { onConflict: 'user_id' })
  if (error) throw new Error(`Could not save Outlook connection: ${error.message}`)
}

/**
 * Mark a connection as needing attention.
 *
 * 'reconnect_needed' is a NORMAL state, not an error — a changed Microsoft
 * password invalidates the refresh token and there is nothing wrong with the
 * CRM when it happens. The UI shows "Reconnect", and the sync job skips the
 * mailbox instead of retrying a credential that can never work again.
 */
export async function markReconnectNeeded(
  supabase: SupabaseClient,
  userId: string,
  detail: string,
): Promise<void> {
  await supabase
    .from('outlook_credentials')
    .update({ status: 'reconnect_needed', status_detail: detail.slice(0, 500) })
    .eq('user_id', userId)
}

export async function recordSync(
  supabase: SupabaseClient,
  userId: string,
  patch: Partial<OutlookCredentials>,
): Promise<void> {
  await supabase
    .from('outlook_credentials')
    .update({ ...patch, last_synced_at: new Date().toISOString() })
    .eq('user_id', userId)
}

/**
 * Disconnect. The row is kept (status 'disconnected') with the tokens wiped:
 * deleting it would orphan the mailbox_user_id on every message already
 * synced, and the history is the point of the feature.
 */
export async function disconnect(supabase: SupabaseClient, userId: string): Promise<void> {
  await supabase
    .from('outlook_credentials')
    .update({
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      status: 'disconnected',
      status_detail: 'Disconnected by the user.',
      inbox_subscription_id: null,
      inbox_subscription_expires_at: null,
      sent_subscription_id: null,
      sent_subscription_expires_at: null,
      inbox_delta_link: null,
      sent_delta_link: null,
    })
    .eq('user_id', userId)
}
