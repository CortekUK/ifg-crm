// Global email branding — the header strip, sender signature, social row,
// partner logos / legal disclaimer, and unsubscribe strip that every
// outgoing email shares.
//
// WHY THIS EXISTS
// Until now each template carried its own private copy of these sections
// inside `email_templates.body_json`, and the header / unsubscribe strips
// were hard-coded in the renderer with no UI to change them at all. That
// meant 22 templates drifted apart: three different social-channel sets,
// two different partner-logo rows, and one template shipping broken links
// (its URLs had a leading space). Changing the footer meant editing every
// template by hand, and newly created templates inherited whatever the
// code defaults happened to be.
//
// Now there is exactly one record (crm_settings key `email_branding`) and
// every template renders markers that the send path fills in. Edit once,
// every existing and future email follows.
//
// DESIGN NOTE — why the config reuses block-content shapes
// The sections are stored as the very same `*BlockContent` objects the
// template editor already understands. That buys us two things for free:
// `lib/templates/render-branding.ts` renders them through the existing
// block renderers (no second copy of the HTML), and the Settings screen
// drives them with the existing editor components (no second copy of the
// UI). Adding a social platform in `social-icons.ts` still lights it up
// everywhere at once.
//
// PERSONALISATION
// The signature section deliberately renders merge tags — literally
// `{{deal_owner_name|Nathan Bibby}}` — rather than resolved values. The
// branding HTML is stitched into the email BEFORE `replaceMergeTags`
// runs, so every deal owner still gets their own name, title, email,
// phone and Calendly link, with the Nathan Bibby fallback intact.

import type {
  RecruiterSignatureBlockContent,
  DividerBlockContent,
  SocialBlockContent,
  CompanySignatureBlockContent,
} from './editor-types'

/** One logo in the header row. */
export interface BrandingHeaderLogo {
  src: string
  alt: string
  /**
   * Rendered width in px. Sized per-logo rather than by a shared height,
   * because the email shell sets `img { height: auto !important }` — a
   * height set here would be overridden in any client that honours the
   * stylesheet. Per-logo width also lets a square crest sit beside a wide
   * wordmark without one dwarfing the other.
   */
  width: number
}

/** Header strip — the dark band at the very top of every email. */
export interface BrandingHeader {
  /**
   * 'text'  — wordmark + strapline only
   * 'logos' — a row of logo images only
   * 'both'  — logo row, with the wordmark beneath it
   */
  mode: 'text' | 'logos' | 'both'
  /**
   * How the logo row and the wordmark sit together when both are shown.
   * Split from `mode` so the two decisions stay separate: what to show,
   * then how to arrange it.
   *
   *   logos-top  — logo row, wordmark beneath
   *   text-top   — wordmark, logo row beneath
   *   logos-left — one line, logos then wordmark
   *   text-left  — one line, wordmark then logos
   */
  arrangement: 'logos-top' | 'text-top' | 'logos-left' | 'text-left'
  /** Large bold wordmark (modes: 'text', 'both'). */
  text: string
  /** Lighter strapline beside the wordmark. Blank to hide. */
  subtext: string
  /** Logo row (modes: 'logos', 'both'). Any number, rendered side by side. */
  logos: BrandingHeaderLogo[]
  /** Horizontal gap between logos, in px. */
  logoGap: number
  bgColor: string
  textColor: string
  /** Optional click-through on the whole header. Blank = not a link. */
  linkUrl: string
}

/**
 * A link that lives in one place and is used by many buttons.
 *
 * Buttons reference it as a merge tag — `{{academy_registration_url|…}}` —
 * rather than holding a pasted URL, so changing the destination here
 * updates every button that uses it, across every template. This is the
 * same mechanism the Calendly buttons already rely on; it just wasn't
 * available for anything else.
 *
 * `key` is the merge-tag name and never changes once created, because
 * templates reference it. `label` is what a human sees and can be renamed
 * freely.
 */
export interface BrandingLink {
  key: string
  label: string
  url: string
  /** Set when the link points at an uploaded document rather than a page. */
  fileName?: string
}

/** The unsubscribe / legal strip below the body. */
export interface BrandingLegal {
  companyName: string
  /**
   * Postal address. UK PECR and CAN-SPAM both expect a real registered
   * address in commercial email — not just a city — so this defaults to
   * the registered office already named in the confidentiality notice.
   */
  addressLine: string
  showUnsubscribe: boolean
  unsubscribeLabel: string
  bgColor: string
  textColor: string
  linkColor: string
}

export interface EmailBranding {
  header: BrandingHeader
  showHeader: boolean

  signature: RecruiterSignatureBlockContent
  showSignature: boolean

  divider: DividerBlockContent
  showDivider: boolean

  social: SocialBlockContent
  showSocial: boolean

  company: CompanySignatureBlockContent
  showCompany: boolean

  legal: BrandingLegal
  showLegal: boolean

  /** Shared links available to any button in any template. */
  links: BrandingLink[]
}

/**
 * Shipped defaults. These are the values migration 162 seeds into
 * `crm_settings`, chosen from what the live templates actually contained:
 *
 *   - Social: the three `ifgmacclesfieldfc` accounts, with the leading
 *     space and share-tracking query strings stripped. X and Flickr are
 *     kept but switched OFF, still pointing at the older MFCIntAcademy
 *     account, so turning them back on is one click and no URL is lost.
 *   - Logos: `lancashire.png` replaces `uclan.png`. The University of
 *     Central Lancashire rebranded to the University of Lancashire, so
 *     20 templates were shipping a retired crest.
 *   - Signature: matches the settings every template already used, with
 *     Calendly still off (no recruiter has a public link configured yet).
 */
export const DEFAULT_EMAIL_BRANDING: EmailBranding = {
  showHeader: true,
  header: {
    mode: 'text',
    arrangement: 'logos-top',
    text: 'IFG',
    subtext: 'International Football Group',
    // Shipped empty; the header editor offers the ready-made white marks.
    logos: [],
    logoGap: 24,
    bgColor: '#0f172a',
    textColor: '#ffffff',
    linkUrl: '',
  },

  showSignature: true,
  signature: {
    showPhoto: false,
    showSignOff: true,
    signOff: 'Kind Regards,',
    showName: true,
    showTitle: true,
    showEmail: true,
    showPhone: true,
    showCalendly: false,
    layout: 'inline',
    alignment: 'left',
    photoSize: 'medium',
    paddingTop: 20,
    paddingBottom: 10,
  },

  showDivider: true,
  divider: {
    style: 'solid',
    color: '#e5e7eb',
    thickness: 1,
    width: '100',
    paddingTop: 10,
    paddingBottom: 10,
  },

  showSocial: true,
  social: {
    platforms: {
      facebook: { enabled: true, url: 'https://www.facebook.com/IFGmacclesfieldfc' },
      instagram: { enabled: true, url: 'https://www.instagram.com/ifgmacclesfieldfc' },
      tiktok: { enabled: true, url: 'https://www.tiktok.com/@ifgmacclesfieldfc' },
      twitter: { enabled: false, url: 'https://twitter.com/MFCIntAcademy' },
      flickr: { enabled: false, url: 'https://www.flickr.com/people/193009807@N04/' },
      linkedin: { enabled: false, url: '' },
      youtube: { enabled: false, url: '' },
      threads: { enabled: false, url: '' },
    },
    style: 'coloured',
    alignment: 'center',
  },

  showCompany: true,
  company: {
    logos: [
      { src: '/signatures/lancashire.png', alt: 'University of Lancashire' },
      { src: '/signatures/ifg.png', alt: 'The International Football Group' },
      { src: '/signatures/macclesfield-fc.png', alt: 'Macclesfield FC' },
    ],
    logoWidth: 120,
    disclaimer:
      'Macc Football Club Limited, a company registered in England. Company number 12931817. Registered office address: The Leasing.com Stadium, London Rd, Macclesfield, SK11 7SP. **Confidentiality:** Privileged / Confidential information may be contained in this message and may be subject to legal privilege. Access to this email by anyone other than the intended is unauthorised. If you are not the intended recipient (or responsible for delivery of the message to such person), you may not use, copy, distribute or deliver to anyone this message (or any part of its contents) or take any action in reliance on it. In such case, you should destroy this message, and notify us immediately. If you have received this email in error, please notify us immediately by email or telephone and delete the email from any company. All reasonable precautions have been taken to ensure no viruses are present in this email. As our company cannot accept responsibility for any loss or damage arising from the use of this email or attachments we recommend that you subject these to your virus checking procedures prior to use.',
    alignment: 'center',
    paddingTop: 24,
    paddingBottom: 16,
  },

  // Seeded from the URLs already hardcoded into the registration buttons,
  // so switching a button over to a shared link is a like-for-like change
  // rather than a re-entry job.
  links: [
    {
      key: 'academy_registration_url',
      label: 'Academy Registration Form',
      url: 'https://ifg-crm-cvz9.vercel.app/programmes/macclesfield/apply?programme=training',
    },
    {
      key: 'gap_year_registration_url',
      label: 'Gap Year Registration Form',
      url: 'https://ifg-crm-cvz9.vercel.app/programmes/macclesfield/apply?programme=gap-year',
    },
  ],

  showLegal: true,
  legal: {
    companyName: 'International Football Group',
    addressLine: 'The Leasing.com Stadium, London Rd, Macclesfield, SK11 7SP, United Kingdom',
    showUnsubscribe: true,
    unsubscribeLabel: 'Unsubscribe',
    bgColor: '#f3f4f6',
    textColor: '#6b7280',
    linkColor: '#3b82f6',
  },
}

/**
 * Merge a stored header over the defaults, upgrading the older single-logo
 * shape on the way.
 *
 * The header originally held one `logoUrl` + `logoWidth` and a mode of
 * 'text' | 'image'. It now holds a row of logos, because a header showing
 * two partner marks side by side was impossible to express before. A record
 * written under the old shape is translated rather than dropped, so nobody
 * loses a logo they had already set.
 */
function normaliseHeader(
  d: BrandingHeader,
  stored?: Partial<BrandingHeader> & { logoUrl?: string; logoWidth?: number },
): BrandingHeader {
  const merged = { ...d, ...(stored ?? {}) }

  const legacyUrl = stored?.logoUrl
  const hasLogos = Array.isArray(merged.logos) && merged.logos.length > 0

  if (!hasLogos && legacyUrl) {
    merged.logos = [
      { src: legacyUrl, alt: merged.text || 'Logo', width: stored?.logoWidth ?? 160 },
    ]
  }
  if (!Array.isArray(merged.logos)) merged.logos = []
  if (!merged.arrangement) merged.arrangement = 'logos-top'

  // The retired 'image' mode maps onto the new logo row.
  if ((merged.mode as string) === 'image') {
    merged.mode = merged.logos.length > 0 ? 'logos' : 'text'
  }

  return merged
}

/**
 * Merge a stored (possibly partial, possibly older) branding record over
 * the defaults. Every nested section is merged one level deep so a record
 * written before a new field existed still renders — the missing field
 * falls back rather than arriving as `undefined` in the HTML.
 */
export function resolveBranding(stored?: Partial<EmailBranding> | null): EmailBranding {
  const d = DEFAULT_EMAIL_BRANDING
  if (!stored) return d

  return {
    showHeader: stored.showHeader ?? d.showHeader,
    header: normaliseHeader(d.header, stored.header),

    showSignature: stored.showSignature ?? d.showSignature,
    signature: { ...d.signature, ...(stored.signature ?? {}) },

    showDivider: stored.showDivider ?? d.showDivider,
    divider: { ...d.divider, ...(stored.divider ?? {}) },

    showSocial: stored.showSocial ?? d.showSocial,
    social: {
      ...d.social,
      ...(stored.social ?? {}),
      // Platforms merge per-key: a record saved before `threads` existed
      // must not lose the platform entirely, or the renderer's registry
      // lookup would hit `undefined`.
      platforms: { ...d.social.platforms, ...(stored.social?.platforms ?? {}) },
    },

    showCompany: stored.showCompany ?? d.showCompany,
    company: { ...d.company, ...(stored.company ?? {}) },

    showLegal: stored.showLegal ?? d.showLegal,
    legal: { ...d.legal, ...(stored.legal ?? {}) },

    // Replaced wholesale, not merged: an admin deleting a shared link must
    // actually delete it. Falls back to the seeded defaults only when the
    // record predates the field entirely.
    links: Array.isArray(stored.links) ? stored.links : d.links,
  }
}

/** Shape stored in `crm_settings.value` under the `email_branding` key. */
export interface EmailBrandingRecord {
  config: EmailBranding
  /**
   * Pre-rendered HTML for each marker slot, merge tags intentionally
   * unresolved. Rendered server-side on save so the Deno edge functions —
   * which cannot import this renderer — only have to do string
   * substitution before their existing merge-tag pass.
   */
  rendered: {
    header: string
    footer: string
    legal: string
  }
  /**
   * Shared link values, flattened to { key: url }. Sent alongside the
   * rendered HTML so the Deno senders can fold them into the merge data
   * without needing to understand the branding config.
   */
  link_values?: Record<string, string>
  rendered_at: string
  /**
   * Bumped whenever `render-branding.ts` changes shape. `npm run
   * publish-branding` re-renders the record so a renderer change can't
   * leave stale HTML in the database; the Settings screen also warns when
   * the stored version is behind.
   */
  renderer_version: number
}

export const BRANDING_RENDERER_VERSION = 4
