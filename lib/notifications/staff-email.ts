import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Email alerts to staff for CRM events.
 *
 * The Settings → Notifications toggles were stored but never read: the
 * screen promised "email alerts for important events" while nothing
 * anywhere sent one. This is the shared path that makes them real, so
 * each event type is a few lines rather than another copy of Resend
 * setup, recipient resolution and HTML.
 *
 * MIRROR: supabase/functions/resend-inbound/index.ts (notifyOwnerOfReply).
 * The email-reply alert lives in a Deno edge function and cannot import
 * this module, so its markup is kept deliberately similar. Change the card
 * layout here and it is worth changing there too.
 *
 * Nothing in here throws. An alert failing must never take down the thing
 * that triggered it — a lead is more important than the email about it.
 */

/** Keys mirror the toggles in Settings → Notifications. */
export type StaffNotificationKey =
  | 'newLead'
  | 'smsReply'
  | 'emailReply'
  | 'paymentReceived'
  | 'dealWon'

interface NotificationSettings {
  emailNotifications?: Partial<Record<StaffNotificationKey, boolean>>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>

/**
 * Is this alert switched on?
 *
 * Missing or unreadable settings mean ON. Someone waiting on a lead is
 * better served by an unexpected email than by silence caused by a
 * settings row that never got written.
 */
export async function staffAlertEnabled(
  supabase: AnyClient,
  key: StaffNotificationKey,
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('crm_settings')
      .select('value')
      .eq('key', 'notifications')
      .maybeSingle()

    const value = (data?.value ?? null) as NotificationSettings | null
    return value?.emailNotifications?.[key] !== false
  } catch (err) {
    console.error(`Notification settings unreadable for "${key}", defaulting to on:`, err)
    return true
  }
}

/** Active admins and super_admins — the org-wide audience. */
export async function adminEmails(supabase: AnyClient): Promise<string[]> {
  const { data } = await supabase
    .from('profiles')
    .select('email')
    .in('role', ['admin', 'super_admin'])
    .eq('is_active', true)

  return (data ?? []).map((p) => p.email as string).filter(Boolean)
}

/** One staff member's email, if they're active and have one. */
export async function ownerEmail(
  supabase: AnyClient,
  ownerId: string | null | undefined,
): Promise<string | null> {
  if (!ownerId) return null
  const { data } = await supabase
    .from('profiles')
    .select('email, is_active')
    .eq('id', ownerId)
    .maybeSingle()

  if (!data?.email || data.is_active === false) return null
  return data.email as string
}

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export interface StaffAlert {
  to: string[]
  subject: string
  heading: string
  /** Label/value rows rendered under the heading. Falsy values are dropped. */
  details?: { label: string; value: string | null | undefined }[]
  /** Optional free-text block, e.g. a message someone sent. */
  body?: string | null
  ctaLabel?: string
  /** Path on the CRM, e.g. "/contacts". Omit for no button. */
  ctaPath?: string
}

/**
 * Send one alert to a set of staff addresses. Recipients are deduplicated,
 * and each gets their own email rather than sharing a To: line, so nobody
 * sees who else was told.
 */
export async function sendStaffAlert(alert: StaffAlert): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.warn('Staff alert skipped: RESEND_API_KEY not configured')
      return
    }

    const recipients = [...new Set(alert.to.filter(Boolean))]
    if (recipients.length === 0) return

    const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev'
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')

    const detailRows = (alert.details ?? [])
      .filter((d) => d.value)
      .map(
        (d) =>
          `<tr>
             <td style="padding:3px 12px 3px 0;font-size:13px;color:#64748b;white-space:nowrap;">${escapeHtml(d.label)}</td>
             <td style="padding:3px 0;font-size:13px;color:#0f172a;">${escapeHtml(String(d.value))}</td>
           </tr>`,
      )
      .join('')

    const bodyBlock = alert.body
      ? `<div style="margin-top:14px;padding:14px 16px;background:#f8fafc;border-left:3px solid #cbd5e1;font-size:14px;line-height:1.6;color:#1f2937;">${escapeHtml(
          alert.body.length > 1200 ? `${alert.body.slice(0, 1200)}…` : alert.body,
        ).replace(/\n/g, '<br/>')}</div>`
      : ''

    const cta =
      appUrl && alert.ctaPath
        ? `<p style="margin:22px 0 0 0;">
             <a href="${appUrl}${alert.ctaPath}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:6px;font-size:14px;">${escapeHtml(
               alert.ctaLabel || 'Open in the CRM',
             )}</a>
           </p>`
        : ''

    const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#0f172a;color:#ffffff;padding:18px 24px;border-radius:8px 8px 0 0;">
    <p style="margin:0;font-size:16px;font-weight:bold;">${escapeHtml(alert.heading)}</p>
  </div>
  <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;padding:24px;">
    ${detailRows ? `<table cellpadding="0" cellspacing="0" border="0">${detailRows}</table>` : ''}
    ${bodyBlock}
    ${cta}
  </div>
</div>`.trim()

    const resend = new Resend(apiKey)

    await Promise.all(
      recipients.map(async (to) => {
        const { error } = await resend.emails.send({
          from: `IFG CRM <${fromEmail}>`,
          to: [to],
          subject: alert.subject,
          html,
        })
        if (error) console.error(`Staff alert to ${to} failed:`, error)
      }),
    )
  } catch (err) {
    console.error('Staff alert threw (the triggering event is unaffected):', err)
  }
}
