import type { SupabaseClient } from '@supabase/supabase-js'
import {
  escapeHtml,
  renderBlocksToHTML,
  renderEmailShell,
  type BrandingSlots,
} from '@/lib/templates/render-html'
import type { EditorBlock, TemplateTheme } from '@/lib/templates/editor-types'
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

/** A typed note, as a block the template renderer understands. */
function noteBlock(text: string): EditorBlock {
  return {
    id: `compose-note-${Date.now()}`,
    type: 'text',
    content: {
      html: textToParagraphs(text),
      alignment: 'left',
      fontSize: 'normal',
      paddingTop: 0,
      paddingBottom: 0,
    },
  }
}

/** A brochure, as the same block the template editor inserts. */
function brochureBlock(b: {
  id: string
  slug: string
  title: string | null
  description: string | null
  cover_image: string | null
  page_count: number | null
}): EditorBlock {
  return {
    id: `compose-brochure-${b.id}`,
    type: 'brochure',
    content: {
      brochureId: b.id,
      slug: b.slug,
      title: b.title ?? 'Brochure',
      description: b.description ?? '',
      coverImage: b.cover_image ?? '',
      pageCount: b.page_count ?? 0,
      buttonText: 'Read the brochure',
      layout: 'book',
      showPageCount: !!b.page_count,
      paddingTop: 16,
      paddingBottom: 8,
    },
  }
}

export interface ComposeParts {
  /** Whatever was typed in the box. Optional when a template is chosen. */
  note?: string | null
  templateId?: string | null
  brochureId?: string | null
}

export interface ComposedEmail {
  html: string
  subject: string
  /** For the UI: what actually went into the message. */
  usedTemplate: string | null
  usedBrochure: string | null
}

/**
 * Assemble a message out of a note, a template and a brochure — any of them,
 * in any combination.
 *
 * ONE path for all four cases, built out of blocks, because blocks are what
 * the renderer already understands. A brochure is the same `brochure` block
 * the template editor inserts, so a brochure sent from the mailbox looks
 * identical to one sent in a campaign; a note is a `text` block above it.
 *
 * A brochure is a LINK, never an attachment. The files are 100–160MB against
 * Outlook's 25MB ceiling, and the gated /b/<slug> page is the thing that
 * captures the lead — attaching the PDF would both fail and lose the reason
 * the brochures exist.
 */
export async function buildComposedEmail(
  supabase: SupabaseClient,
  opts: {
    senderUserId: string
    contactId: string | null
    origin: string | null
    subject: string
    parts: ComposeParts
    slots: BrandingSlots
  },
): Promise<ComposedEmail> {
  const { parts, slots } = opts

  const [template, brochure] = await Promise.all([
    parts.templateId
      ? supabase
          .from('email_templates')
          .select('id, name, subject, body_json, body_html, theme, use_global_branding')
          .eq('id', parts.templateId)
          .maybeSingle()
          .then((r) => r.data)
      : null,
    parts.brochureId
      ? supabase
          .from('website_brochures')
          .select('id, slug, title, description, cover_image, page_count, render_status')
          .eq('id', parts.brochureId)
          .maybeSingle()
          .then((r) => r.data)
      : null,
  ])

  const data = await composeMergeData(supabase, opts.senderUserId, opts.contactId, opts.origin)

  const t = template as {
    name: string
    subject: string | null
    body_json: unknown
    body_html: string | null
    theme: TemplateTheme | null
    use_global_branding: boolean | null
  } | null

  const blocks: EditorBlock[] = []
  if (parts.note?.trim()) blocks.push(noteBlock(parts.note))

  if (t) {
    const stored = Array.isArray(t.body_json)
      ? (t.body_json as EditorBlock[])
      : ((t.body_json as { blocks?: EditorBlock[] } | null)?.blocks ?? [])
    // Two of the live templates were imported as raw HTML and have no blocks.
    // They go in as an html block rather than being refused, so every template
    // in the list can actually be sent.
    if (stored.length) blocks.push(...stored)
    else if (t.body_html) {
      blocks.push({ id: 'compose-template-html', type: 'html', content: { code: t.body_html } })
    }
  }

  const b = brochure as Parameters<typeof brochureBlock>[0] | null
  if (b?.slug) blocks.push(brochureBlock(b))

  // A template that owns its own masthead keeps it — `use_global_branding:
  // false` is how a designed email says the global band fights its layout.
  const globalBranding = t ? t.use_global_branding !== false : true

  const html = blocks.length
    ? replaceMergeTags(
        renderBlocksToHTML(blocks, t?.theme ?? null, slots, { globalBranding }),
        data,
      )
    : brandedDocument('', slots, data)

  return {
    html,
    // The template's own subject wins only when the sender left theirs empty.
    subject: replaceMergeTags(opts.subject?.trim() || t?.subject || '', data),
    usedTemplate: t?.name ?? null,
    usedBrochure: b?.title ?? null,
  }
}
