import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/outlook/credentials'
import { syncAllMailboxes } from '@/lib/outlook/sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Mailboxes are swept one at a time; the default 10s would cut the run short
// and leave delta cursors unsaved.
export const maxDuration = 300

/**
 * Hourly: renew Graph subscriptions and run the catch-up sweep.
 *
 * Configured in vercel.json. Both halves matter and for different reasons:
 *
 *   RENEWAL — Graph expires mail subscriptions after about three days. If
 *   nobody renews them, notifications stop and NOTHING errors. The inbox just
 *   goes quiet, which looks exactly like a slow week.
 *
 *   SWEEP — notifications get missed even while subscriptions are healthy.
 *   The delta query asks Graph what changed since last time and fills gaps.
 *
 * Auth mirrors the existing cron routes: Vercel's own header, or a bearer
 * CRON_SECRET for manual runs.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = request.headers.get('x-vercel-cron') === '1'
  const hasValidSecret = cronSecret && authHeader === `Bearer ${cronSecret}`
  const isDevelopment = process.env.NODE_ENV === 'development'

  if (!isVercelCron && !hasValidSecret && !isDevelopment) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    const summaries = await syncAllMailboxes(supabase)
    const totals = summaries.reduce(
      (acc, s) => ({
        inserted: acc.inserted + s.inserted,
        duplicates: acc.duplicates + s.duplicates,
        skipped: acc.skipped + s.skipped,
      }),
      { inserted: 0, duplicates: 0, skipped: 0 },
    )
    return NextResponse.json({
      success: true,
      mailboxes: summaries.length,
      ...totals,
      details: summaries,
    })
  } catch (error) {
    console.error('outlook sync cron failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
