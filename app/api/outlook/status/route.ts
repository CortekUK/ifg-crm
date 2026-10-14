import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOutlookConfig } from '@/lib/outlook/config'
import { tokenEncryptionAvailable } from '@/lib/outlook/crypto'
import { getCredentials, getServiceClient, disconnect } from '@/lib/outlook/credentials'
import { removeSubscriptions } from '@/lib/outlook/subscriptions'

export const runtime = 'nodejs'

/**
 * Connection status for the signed-in user.
 *
 * Deliberately returns NO token material — not even a masked form. The browser
 * has no use for it, and the only safe place for a Microsoft refresh token is
 * the server.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const configured = !!getOutlookConfig() && tokenEncryptionAvailable()

  const service = getServiceClient()
  if (!service) {
    return NextResponse.json({ configured: false, connected: false, status: 'disconnected' })
  }

  const credentials = await getCredentials(service, user.id)
  if (!credentials) {
    return NextResponse.json({ configured, connected: false, status: 'disconnected' })
  }

  return NextResponse.json({
    configured,
    connected: credentials.status === 'connected',
    status: credentials.status,
    statusDetail: credentials.status_detail,
    mailboxEmail: credentials.mailbox_email,
    mailboxDisplayName: credentials.mailbox_display_name,
    connectedAt: credentials.connected_at,
    lastSyncedAt: credentials.last_synced_at,
    lastSyncError: credentials.last_sync_error,
    // Surfaced so a lapsed subscription is visible in the UI rather than
    // presenting as "nobody emailed me today".
    notificationsActive: !!(
      credentials.inbox_subscription_expires_at &&
      new Date(credentials.inbox_subscription_expires_at) > new Date()
    ),
  })
}

/** Disconnect this user's mailbox. */
export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const service = getServiceClient()
  if (!service) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

  const credentials = await getCredentials(service, user.id)
  if (credentials) {
    // Tell Graph to stop posting to us first. Best-effort: if the token is
    // already dead the subscription will expire on its own within days, and
    // failing here must not block the user from disconnecting.
    try {
      await removeSubscriptions(service, user.id, credentials)
    } catch {
      /* ignore */
    }
    await disconnect(service, user.id)
  }

  return NextResponse.json({ success: true })
}
