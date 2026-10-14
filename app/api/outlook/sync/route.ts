import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCredentials, getServiceClient } from '@/lib/outlook/credentials'
import { syncMailbox } from '@/lib/outlook/sync'

export const runtime = 'nodejs'
export const maxDuration = 120

/** "Sync now" — runs the delta sweep for the signed-in user's own mailbox. */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const service = getServiceClient()
  if (!service) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

  const credentials = await getCredentials(service, user.id)
  if (!credentials || credentials.status !== 'connected') {
    return NextResponse.json({ error: 'No Outlook mailbox is connected.' }, { status: 400 })
  }

  const summary = await syncMailbox(service, credentials)
  return NextResponse.json({ success: true, ...summary })
}
