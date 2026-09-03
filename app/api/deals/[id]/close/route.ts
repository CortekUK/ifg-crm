import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  staffAlertEnabled,
  sendStaffAlert,
  adminEmails,
  ownerEmail,
} from '@/lib/notifications/staff-email'

/**
 * Close a deal as won or lost.
 *
 * This lives server-side rather than as a direct client write for one
 * reason: the "Deal won" toggle in Settings → Notifications needs to
 * actually send something. A browser cannot read `crm_settings` for the
 * toggle and cannot hold the Resend key, so the alert has to be sent from
 * here.
 *
 * The write itself is deliberately narrow — status plus the matching
 * timestamp — so it cannot be used to edit anything else about a deal.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { outcome } = (await request.json()) as { outcome?: string }
    if (outcome !== 'won' && outcome !== 'lost') {
      return NextResponse.json(
        { error: 'outcome must be "won" or "lost"' },
        { status: 400 },
      )
    }

    const now = new Date().toISOString()

    // RLS decides whether this user may touch this deal. `.select()` makes
    // the result observable: no row back means the update matched nothing,
    // which is a failure the caller must see rather than a silent no-op.
    const { data: updated, error } = await supabase
      .from('deals')
      .update(
        outcome === 'won'
          ? { status: 'won', won_at: now, lost_at: null }
          : { status: 'lost', lost_at: now, won_at: null },
      )
      .eq('id', id)
      .select('id, title, value, deal_owner_id, contact:contacts(first_name, last_name), pipeline:pipelines(name)')
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!updated) {
      return NextResponse.json(
        { error: 'Deal not found, or you do not have permission to close it.' },
        { status: 404 },
      )
    }

    await supabase.from('deal_activities').insert({
      deal_id: id,
      activity_type: outcome === 'won' ? 'deal_won' : 'deal_lost',
      description: `Deal marked as ${outcome}`,
      performed_by_id: user.id,
    })

    // The alert must never be able to undo a close that already happened.
    if (outcome === 'won') {
      try {
        if (await staffAlertEnabled(supabase, 'dealWon')) {
          const contact = updated.contact as { first_name?: string; last_name?: string } | null
          const playerName =
            `${contact?.first_name ?? ''} ${contact?.last_name ?? ''}`.trim() ||
            updated.title ||
            'A player'

          const recipients = await adminEmails(supabase)
          const owner = await ownerEmail(supabase, updated.deal_owner_id)
          if (owner) recipients.push(owner)

          const value =
            typeof updated.value === 'number' && updated.value > 0
              ? new Intl.NumberFormat('en-GB', {
                  style: 'currency',
                  currency: 'GBP',
                  maximumFractionDigits: 0,
                }).format(updated.value)
              : null

          await sendStaffAlert({
            to: recipients,
            subject: `Deal won — ${playerName}`,
            heading: `Deal won — ${playerName}`,
            details: [
              { label: 'Programme', value: (updated.pipeline as { name?: string } | null)?.name },
              { label: 'Value', value },
            ],
            ctaLabel: 'Open the pipeline',
            ctaPath: '/pipelines',
          })
        }
      } catch (err) {
        console.error('Deal-won alert failed (the deal is still closed):', err)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
