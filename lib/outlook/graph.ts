import type { SupabaseClient } from '@supabase/supabase-js'
import { GRAPH_BASE, OUTLOOK_SCOPES, getOutlookConfig, tokenEndpoint, type OutlookConfig } from './config'
import {
  decryptCredentials,
  getCredentials,
  markReconnectNeeded,
  saveTokens,
  type OutlookCredentials,
} from './credentials'

/**
 * Microsoft Graph access: token exchange, refresh, and an authenticated fetch.
 *
 * The rule the spec puts first — "tokens expire every hour; refresh BEFORE
 * every call, do not wait for a failure" — is enforced here in one place, so
 * no caller has to remember it.
 */

export class OutlookReconnectRequired extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OutlookReconnectRequired'
  }
}

export class GraphError extends Error {
  status: number
  code: string | null
  constructor(message: string, status: number, code: string | null) {
    super(message)
    this.name = 'GraphError'
    this.status = status
    this.code = code
  }
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  error?: string
  error_description?: string
}

async function requestToken(
  config: OutlookConfig,
  body: Record<string, string>,
): Promise<TokenResponse> {
  const res = await fetch(tokenEndpoint(config), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      ...body,
    }),
    cache: 'no-store',
  })

  const data = (await res.json().catch(() => ({}))) as TokenResponse
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Token request failed (${res.status})`)
  }
  return data
}

/** Swap the one-time code from the consent redirect for tokens. */
export async function exchangeCodeForTokens(config: OutlookConfig, code: string) {
  return requestToken(config, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    scope: OUTLOOK_SCOPES.join(' '),
  })
}

/**
 * A valid access token for this user, refreshing first if it is close to
 * expiry.
 *
 * The 5-minute margin is deliberate: a token that passes an `expiresAt > now`
 * check can still expire mid-request on a slow sync, and the failure surfaces
 * as a confusing 401 partway through a batch rather than at the start.
 *
 * Throws OutlookReconnectRequired when the refresh token itself is rejected —
 * normally a password change. The connection is marked so the UI can offer
 * Reconnect, and the sync job stops hammering a credential that cannot work.
 */
export async function getAccessToken(
  supabase: SupabaseClient,
  userId: string,
  credentials?: OutlookCredentials | null,
): Promise<string> {
  const config = getOutlookConfig()
  if (!config) throw new Error('Outlook is not configured on this deployment.')

  const creds = credentials ?? (await getCredentials(supabase, userId))
  if (!creds) throw new OutlookReconnectRequired('No Outlook connection for this user.')
  if (creds.status === 'disconnected') {
    throw new OutlookReconnectRequired('This Outlook mailbox has been disconnected.')
  }

  const { accessToken, refreshToken, expiresAt } = decryptCredentials(creds)

  const MARGIN_MS = 5 * 60 * 1000
  const stillValid = accessToken && expiresAt && expiresAt.getTime() - Date.now() > MARGIN_MS
  if (stillValid) return accessToken

  if (!refreshToken) {
    await markReconnectNeeded(supabase, userId, 'Stored credentials could not be read.')
    throw new OutlookReconnectRequired('Outlook needs reconnecting.')
  }

  try {
    const refreshed = await requestToken(config, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: OUTLOOK_SCOPES.join(' '),
    })
    await saveTokens(supabase, userId, {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? null,
      expiresInSeconds: refreshed.expires_in,
    })
    return refreshed.access_token
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Refresh failed'
    await markReconnectNeeded(supabase, userId, detail)
    throw new OutlookReconnectRequired(`Outlook needs reconnecting: ${detail}`)
  }
}

/**
 * Authenticated Graph call.
 *
 * `path` may be a Graph path ('/me/messages') or an absolute URL — delta and
 * paging links come back from Graph fully qualified, so both must work.
 */
export async function graphFetch<T = unknown>(
  supabase: SupabaseClient,
  userId: string,
  path: string,
  init: RequestInit = {},
  credentials?: OutlookCredentials | null,
): Promise<T> {
  const token = await getAccessToken(supabase, userId, credentials)
  const url = path.startsWith('http') ? path : `${GRAPH_BASE}${path}`

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  })

  // 202/204 carry no body — sendMail and reply both answer this way on success.
  if (res.status === 202 || res.status === 204) return undefined as T

  const text = await res.text()
  const data = text ? JSON.parse(text) : undefined

  if (!res.ok) {
    const error = (data as { error?: { code?: string; message?: string } })?.error
    if (res.status === 401) {
      await markReconnectNeeded(supabase, userId, error?.message || 'Microsoft rejected the token.')
      throw new OutlookReconnectRequired('Outlook needs reconnecting.')
    }
    throw new GraphError(
      error?.message || `Graph request failed (${res.status})`,
      res.status,
      error?.code ?? null,
    )
  }

  return data as T
}

/** The signed-in user's mailbox identity, read straight after consent. */
export async function fetchGraphMe(accessToken: string): Promise<{
  id: string
  mail: string | null
  userPrincipalName: string | null
  displayName: string | null
}> {
  const res = await fetch(`${GRAPH_BASE}/me?$select=id,mail,userPrincipalName,displayName`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Could not read the Microsoft profile (${res.status})`)
  return res.json()
}
