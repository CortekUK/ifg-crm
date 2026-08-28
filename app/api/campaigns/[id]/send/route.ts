import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// API route to trigger immediate campaign sending
// POST /api/campaigns/[id]/send

export const runtime = 'edge'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params

    if (!campaignId) {
      return NextResponse.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      )
    }

    // Get Supabase credentials
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch the campaign
    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('id, name, status, type, recipient_list_ids, recipient_tag_ids, recipient_stage_ids')
      .eq('id', campaignId)
      .single()

    if (fetchError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Validate campaign can be sent (draft, scheduled, sent for resend, or sending to continue)
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled' && campaign.status !== 'sent' && campaign.status !== 'sending') {
      return NextResponse.json(
        { error: `Campaign cannot be sent - current status is "${campaign.status}"` },
        { status: 400 }
      )
    }

    if (campaign.type !== 'email') {
      return NextResponse.json(
        { error: 'Only email campaigns can be sent at this time' },
        { status: 400 }
      )
    }

    // Count recipients across all three sources, in SQL. Counting client-side
    // here capped at 1,000 (PostgREST's default) and also ignored tag and
    // stage audiences entirely.
    const listIds = campaign.recipient_list_ids || []
    const tagIds = campaign.recipient_tag_ids || []
    const stageIds = campaign.recipient_stage_ids || []

    const { data: audienceCount, error: countError } = await supabase.rpc(
      'campaign_audience_count',
      {
        p_list_ids: listIds,
        p_tag_ids: tagIds,
        p_stage_ids: stageIds,
        p_type: campaign.type,
      }
    )

    if (countError) {
      console.error('Failed to count campaign audience:', countError)
      return NextResponse.json(
        { error: 'Could not work out who this campaign goes to' },
        { status: 500 }
      )
    }

    const recipientCount = Number(audienceCount ?? 0)

    if (recipientCount === 0) {
      return NextResponse.json(
        {
          error:
            'Campaign has no recipients — add at least one list, tag or pipeline stage, ' +
            'and check the contacts in it are still subscribed.',
        },
        { status: 400 }
      )
    }

    // Update campaign to scheduled with immediate scheduled_at (skip if already sending)
    if (campaign.status !== 'sending') {
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({
          status: 'scheduled',
          scheduled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId)

      if (updateError) {
        console.error('Failed to update campaign:', updateError)
        return NextResponse.json(
          { error: 'Failed to schedule campaign' },
          { status: 500 }
        )
      }
    }

    // Optionally trigger immediate processing
    // The cron job will pick it up within a minute, but we can kick it off now
    try {
      await fetch(`${supabaseUrl}/functions/v1/process-campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({}),
      })
    } catch (triggerError) {
      // Don't fail if immediate trigger fails - cron will pick it up
      console.warn('Failed to trigger immediate processing:', triggerError)
    }

    return NextResponse.json({
      success: true,
      message: 'Campaign is now sending',
      campaignId,
      recipientCount,
    })

  } catch (error) {
    console.error('Send campaign error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
