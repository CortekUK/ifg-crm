// Send a test email of the in-progress template to the logged-in user.
//
// Used by the editor's "Send Test Email" button. The editor passes its
// current in-memory block tree + settings (blocks may not be saved yet),
// so we render here on the server and ship via Resend to the caller's
// own address. Sample data is substituted for merge tags so the preview
// looks like a real send.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { renderBlocksToHTML } from '@/lib/templates/render-html'
import { replaceMergeTags } from '@/lib/utils/merge-tags-core'
import type { EditorBlock, TemplateTheme } from '@/lib/templates/editor-types'

const SAMPLE_MERGE_DATA = {
  first_name: 'Sarah',
  last_name: 'Test',
  email: '',
  phone: '+44 7700 900123',
  deal_title: 'Sarah Test',
  deal_value: 5000,
  deal_stage: 'Initial Contact',
  deal_pipeline: 'UK GAP 2026',
  deal_owner_name: 'Deal Owner',
  deal_owner_title: 'Recruitment Lead',
  deal_owner_email: '',
  deal_owner_phone: '+44 7700 900456',
  deal_owner_calendly: 'https://calendly.com/example',
  deal_owner_signature: 'Best regards,<br>The IFG Team',
  schedule_link: 'https://calendly.com/example',
  meeting_link: 'https://meet.google.com/abc-defg-hij',
  meeting_time: 'Mon, 1 Jan 2026 at 3:00 PM',
  interview_date: 'Mon, 1 Jan 2026 at 3:00 PM',
  meeting_event_name: '30 Minute Meeting',
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!user.email) {
      return NextResponse.json(
        { error: 'Your account has no email address — cannot send test.' },
        { status: 400 },
      )
    }

    const body = await request.json()
    const blocks = (body.blocks || []) as EditorBlock[]
    const subject = String(body.subject || 'Test email')
    const theme = (body.theme ?? null) as TemplateTheme | null

    if (!Array.isArray(blocks) || blocks.length === 0) {
      return NextResponse.json(
        { error: 'Template has no content yet — add at least one block first.' },
        { status: 400 },
      )
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
    }

    // Pull the caller's real profile so owner-related merge tags
    // (Calendly URL, phone, title, signature) resolve to actual values
    // instead of placeholders. Otherwise the "Book a meeting" button in
    // a test email points at calendly.com/example and 404s.
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, phone, title, calendly_url, email_signature, avatar_url')
      .eq('id', user.id)
      .single()

    const fallbackName = user.email.split('@')[0]
    const userName = profile?.full_name || user.user_metadata?.full_name || fallbackName
    const ownerCalendly = profile?.calendly_url || SAMPLE_MERGE_DATA.deal_owner_calendly

    const data = {
      ...SAMPLE_MERGE_DATA,
      email: user.email,
      first_name: userName.split(' ')[0] || 'there',
      last_name: userName.split(' ').slice(1).join(' ') || '',
      deal_owner_name: userName,
      deal_owner_email: profile?.email || user.email,
      deal_owner_phone: profile?.phone || SAMPLE_MERGE_DATA.deal_owner_phone,
      deal_owner_title: profile?.title || SAMPLE_MERGE_DATA.deal_owner_title,
      deal_owner_calendly: ownerCalendly,
      deal_owner_signature: profile?.email_signature || SAMPLE_MERGE_DATA.deal_owner_signature,
      deal_owner_photo: profile?.avatar_url || null,
      // Tags used by meeting_scheduler templates: schedule_link aliases
      // the deal owner's Calendly URL.
      schedule_link: ownerCalendly,
    }

    const rawHtml = renderBlocksToHTML(blocks, theme)
    const html = replaceMergeTags(rawHtml, data)
    const renderedSubject = replaceMergeTags(subject, data)

    const resend = new Resend(apiKey)
    const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev'

    const result = await resend.emails.send({
      from: `IFG Test <${fromEmail}>`,
      to: [user.email],
      subject: `[TEST] ${renderedSubject}`,
      html,
    })

    if (result.error) {
      const message =
        typeof result.error === 'object' && result.error !== null && 'message' in result.error
          ? String((result.error as { message: unknown }).message)
          : 'Email failed'
      return NextResponse.json({ error: message }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      sent_to: user.email,
      resend_id: result.data?.id ?? null,
    })
  } catch (error) {
    console.error('Send test email error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send test' },
      { status: 500 },
    )
  }
}
