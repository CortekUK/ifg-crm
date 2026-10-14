/**
 * Microsoft Graph configuration for the Outlook mailbox feature.
 *
 * The app registration already exists in Macclesfield FC's Microsoft 365 —
 * nothing to create. Tenant and client id are identifiers, not secrets, but
 * they still come from the environment so the CRM can be pointed at a test
 * tenant without a code change. The CLIENT SECRET is environment-only and
 * must never appear in code (it also expires 24 months from issue, at which
 * point every connection breaks at once).
 */

export const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

/**
 * Delegated scopes. These are what the app registration has already been
 * granted; asking for anything outside this set makes consent fail.
 *
 *   offline_access  — issues the refresh token. Without it the connection
 *                     dies after an hour and never comes back.
 *   User.Read       — the signed-in user's name and mailbox address.
 *   Mail.Send       — send as them.
 *   Mail.ReadWrite  — read the mailbox, and create replies (createReply needs
 *                     write, not just read).
 */
export const OUTLOOK_SCOPES = ['offline_access', 'User.Read', 'Mail.Send', 'Mail.ReadWrite'] as const

export interface OutlookConfig {
  tenantId: string
  clientId: string
  clientSecret: string
  redirectUri: string
}

/** The folders we watch. Sent Items matters: without it, a recruiter replying
 *  from Outlook directly leaves a hole in the CRM's copy of the thread. */
export const WATCHED_FOLDERS = ['inbox', 'sentitems'] as const
export type WatchedFolder = (typeof WATCHED_FOLDERS)[number]

/**
 * Where Microsoft sends the user back after consent.
 *
 * Must match a Redirect URI registered in Entra EXACTLY, or sign-in fails with
 * AADSTS50011 before the user ever reaches the consent screen. Note the CRM's
 * dev server runs on port 3016 (see package.json), not 3000 — so local
 * development needs http://localhost:3016/api/auth/microsoft/callback added in
 * Entra alongside the production URL.
 */
function defaultRedirectUri(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3016').replace(/\/$/, '')
  return `${base}/api/auth/microsoft/callback`
}

/**
 * Returns the config, or null when Outlook has not been configured.
 *
 * Null rather than throwing: an unconfigured deployment must show "not
 * available" in Settings and leave the rest of the CRM untouched, never 500.
 */
export function getOutlookConfig(): OutlookConfig | null {
  const tenantId = process.env.MICROSOFT_TENANT_ID
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  if (!tenantId || !clientId || !clientSecret) return null
  return {
    tenantId,
    clientId,
    clientSecret,
    redirectUri: process.env.MICROSOFT_REDIRECT_URI || defaultRedirectUri(),
  }
}

export function authorizeUrl(config: OutlookConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    response_mode: 'query',
    scope: OUTLOOK_SCOPES.join(' '),
    state,
    // Forces the account chooser. Without it a user already signed into a
    // different Microsoft account is silently connected to the wrong mailbox,
    // which is very hard to spot afterwards.
    prompt: 'select_account',
  })
  return `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?${params}`
}

export function tokenEndpoint(config: OutlookConfig): string {
  return `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`
}

/**
 * Where Graph posts change notifications.
 *
 * Must be publicly reachable HTTPS — Microsoft will not deliver to localhost,
 * so local development relies on the catch-up sweep rather than notifications.
 */
export function notificationUrl(): string | null {
  const base = (process.env.MICROSOFT_NOTIFICATION_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  if (!base || base.startsWith('http://localhost')) return null
  return `${base}/api/webhooks/microsoft`
}
