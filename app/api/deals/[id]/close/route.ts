import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  staffAlertEnabled,
  sendStaffAlert,
  alertRecipients,
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
 * The write itself is deliberately narrow — status, the matching timestamp and
 * the lost reason — so it cannot be used to edit anything else about a deal.
 *
 * `lost_reason` was never written by anything, while Reports has had a "Lost
 * reason" column reading it all along, so that column could only ever be
 * blank. Marking a deal won clears it, so a reopened-then-won deal does not
 * keep the note explaining why it was lost.
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

    const { outcome, reason } = (await request.json()) as {
      outcome?: string
      reason?: string
    }
    if (outcome !== 'won' && outcome !== 'lost') {
      return NextResponse.json(
        { error: 'outcome must be "won" or "lost"' },
        { status: 400 },
      )
    }

    // Why a deal was lost is the one field Reports cannot derive. Trimmed to
    // null when blank so "no reason given" is a null rather than an empty
    // string, and capped because this is free text from a browser.
    const lostReason =
      typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 500) : null

    const now = new Date().toISOString()

    // RLS decides whether this user may touch this deal. `.select()` makes
    // the result observable: no row back means the update matched nothing,
    // which is a failure the caller must see rather than a silent no-op.
    const { data: updated, error } = await supabase
      .from('deals')
      .update(
        outcome === 'won'
          ? { status: 'won', won_at: now, lost_at: null, lost_reason: null }
          : { status: 'lost', lost_at: now, won_at: null, lost_reason: lostReason },
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

    // Timeline entry. The result is checked rather than discarded: this insert
    // was being rejected by the activity_type CHECK constraint on every close
    // (neither 'deal_won' nor 'deal_lost' was in it — migration 189 adds them)
    // and nobody could tell, because nothing read the error. The close itself
    // has already happened and must not be undone by a failed audit line, so
    // this logs rather than throws.
    const { error: activityError } = await supabase.from('deal_activities').insert({
      deal_id: id,
      activity_type: outcome === 'won' ? 'deal_won' : 'deal_lost',
      description:
        outcome === 'lost' && lostReason
          ? `Deal marked as lost — ${lostReason}`
          : `Deal marked as ${outcome}`,
      performed_by_id: user.id,
    })
    if (activityError) {
      console.error(
        `Deal ${id} was closed as ${outcome}, but the timeline entry failed:`,
        activityError.message,
      )
    }

    // The alert must never be able to undo a close that already happened.
    if (outcome === 'won') {
      try {
        if (await staffAlertEnabled(supabase, 'dealWon')) {
          const contact = updated.contact as { first_name?: string; last_name?: string } | null
          const playerName =
            `${contact?.first_name ?? ''} ${contact?.last_name ?? ''}`.trim() ||
            updated.title ||
            'A player'

          // The owner, or the admins when nobody owns the player. Admins used
          // to be added to EVERY deal-won alert on top of the owner, which is
          // not the rule this alert is meant to follow (QA-51 Issue 1).
          const recipients = await alertRecipients(supabase, updated.deal_owner_id)

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
