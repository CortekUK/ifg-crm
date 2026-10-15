import type { SupabaseClient } from '@supabase/supabase-js'
import { escapeHtml, renderEmailShell, type BrandingSlots } from '@/lib/templates/render-html'
import { replaceMergeTags, type MergeTagData } from '@/lib/utils/merge-tags-core'
import { unsubscribeUrl } from '@/lib/email/unsubscribe'

/**
 * Turn what somebody typed in Compose into a branded IFG email.
 *
 * Mail sent from the mailbox went out as the raw contents of a textarea — no
 * masthead, no signature, no company details — while every campaign and every
 * template test went out through the global branding. The same business was
 * sending two completely different-looking emails depending on which screen
 * it was written from, and the personal one, the one a parent is most likely
 * to read closely, was the bare one.
 *
 * There is exactly one branding renderer in this codebase (render-html and
 * render-branding) and this file reaches for it rather than growing a second.
 *
 * NEW MESSAGES get the full shell: masthead, body, signature, legal strip.
 * REPLIES get a fragment — signature and legal, no masthead. Graph builds the
 * reply document itself, with the quoted history below, so a full document
 * would nest one inside another; and a masthead repeated on every message of
 * a back-and-forth is what makes a real conversation look automated.
 */

/** Plain text from the compose box, as HTML paragraphs. */
export function textToParagraphs(text: string): string {
  const safe = escapeHtml(text ?? '').trim()
  if (!safe) return ''
  return safe
    .split(/\n{2,}/)
    .map((para) => `<p style="margin: 0 0 16px 0;">${para.replace(/\n/g, '<br />')}</p>`)
    .join('')
}

/**
 * Merge-tag values for a message one person is sending to one other person.
 *
 * The branding slots emit {{deal_owner_name}}, {{deal_owner_signature}} and
 * {{unsubscribe_url}} unresolved on purpose — the send path fills them, so
 * the signature carries the real sender rather than a placeholder. Here the
 * "deal owner" is simply whoever pressed Send.
 */
export async function composeMergeData(
  supabase: SupabaseClient,
  senderUserId: string,
  contactId: string | null,
  origin: string | null,
): Promise<MergeTagData> {
  const [{ data: sender }, contactResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, email, phone, title, calendly_url, email_signature, avatar_url')
      .eq('id', senderUserId)
      .maybeSingle(),
    contactId
      ? supabase
          .from('contacts')
          .select('first_name, last_name, email, phone')
          .eq('id', contactId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const s = (sender ?? {}) as Record<string, string | null>
  const c = (contactResult?.data ?? {}) as Record<string, string | null>

  return {
    // "there" rather than an empty string: "Hi ," is worse than "Hi there,".
    first_name: c.first_name || 'there',
    last_name: c.last_name || null,
    email: c.email || null,
    phone: c.phone || null,

    deal_owner_name: s.full_name || null,
    deal_owner_email: s.email || null,
    deal_owner_phone: s.phone || null,
    deal_owner_title: s.title || null,
    deal_owner_calendly: s.calendly_url || null,
    deal_owner_signature: s.email_signature || null,
    deal_owner_photo: s.avatar_url || null,
    schedule_link: s.calendly_url || null,

    // The legal strip carries {{unsubscribe_url}}. Left unresolved it renders
    // a dead Unsubscribe link, which looks like a broken email and is worse
    // than having none. A contact we have just created still has an id, so
    // even cold outreach gets a working one.
    unsubscribe_url: contactId ? (await unsubscribeUrl(contactId, origin)) ?? '' : '',
  }
}

/** A complete branded email document. Used for new messages. */
export function brandedDocument(
  innerHtml: string,
  slots: BrandingSlots,
  data: MergeTagData,
): string {
  return replaceMergeTags(renderEmailShell(innerHtml, null, slots), data)
}

/**
 * A branded fragment for a reply: the message, then the signature and legal
 * strip. No masthead and no <html> wrapper — Graph supplies both.
 */
export function brandedReplyFragment(
  innerHtml: string,
  slots: BrandingSlots,
  data: MergeTagData,
): string {
  return replaceMergeTags(`${innerHtml}${slots.footer ?? ''}${slots.legal ?? ''}`, data)
}
