// Renders the global email branding into the three marker slots the email
// shell emits. See `branding-types.ts` for why this is global rather than
// per-template.
//
// Everything below the body — signature, divider, social row, partner
// logos and disclaimer — is rendered through the SAME block renderers the
// template editor uses (`renderBlock`), so there is exactly one copy of
// that markup in the codebase. Only the header strip and the legal strip
// are rendered here directly, because neither was ever a block.
//
// MERGE TAGS ARE LEFT UNRESOLVED ON PURPOSE. The signature emits literal
// `{{deal_owner_name|Nathan Bibby}}` text and the legal strip emits
// `{{unsubscribe_url}}`. The send path stitches this HTML in and only
// then runs `replaceMergeTags`, so each recipient still gets their deal
// owner's real details.

import type { EditorBlock, TemplateTheme } from './editor-types'
import type { EmailBranding } from './branding-types'
import { DEFAULT_EMAIL_BRANDING } from './branding-types'
import {
  BRANDING_MARKERS,
  renderBlock,
  renderBlocksToHTML,
  resolveAssetUrl,
  type BrandingSlots,
  escapeHtml,
} from './render-html'

/** Wrap `inner` in an anchor when the header has a click-through URL. */
function maybeLink(inner: string, url: string): string {
  const href = (url || '').trim()
  if (!href) return inner
  return `<a href="${escapeHtml(href)}" target="_blank" style="text-decoration: none;">${inner}</a>`
}

function renderHeader(b: EmailBranding): string {
  if (!b.showHeader) return ''
  const h = b.header

  const logos = (h.logos ?? []).filter((l) => l.src)
  const gap = Math.max(0, h.logoGap ?? 24)

  // Logos sit in one centred row. Width is set on each image (not height) —
  // the shell's stylesheet forces `height: auto !important`, so a height set
  // here would be ignored wherever that CSS is honoured.
  //
  // A logo needs a transparent background: on a dark header, a mark saved
  // with white baked in renders as a visible white box.
  const styled = (b.header.style ?? 'plain') !== 'plain'

  // Two or more marks in a styled header read as a partnership lockup when a
  // hairline separates them — the difference between "our logo and their logo"
  // and "IFG × Macclesfield". A single mark gets no rule to sit against.
  const dividedLogoRow =
    styled && logos.length > 1
      ? `<table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
        <tr>${logos
          .map(
            (l, i) =>
              `${
                i > 0
                  ? `<td style="width: 1px; padding: 0 ${Math.round(
                      gap / 2,
                    )}px;"><div style="width: 1px; height: 34px; background-color: rgba(255,255,255,0.22); font-size: 0; line-height: 0;">&nbsp;</div></td>`
                  : ''
              }<td style="vertical-align: middle; line-height: 0;"><img class="ifg-header-logo" src="${escapeHtml(
                resolveAssetUrl(l.src),
              )}" alt="${escapeHtml(l.alt || '')}" width="${l.width}" style="display: block; width: ${
                l.width
              }px; max-width: 100%; height: auto; border: 0;" /></td>`,
          )
          .join('')}</tr>
      </table>`
      : ''

  const logoRow =
    dividedLogoRow ||
    (logos.length > 0
      ? `<div class="ifg-header-logos" style="text-align: center; line-height: 0;">${logos
          .map(
            (l) =>
              `<img class="ifg-header-logo" src="${escapeHtml(
                resolveAssetUrl(l.src),
              )}" alt="${escapeHtml(l.alt || '')}" width="${l.width}" style="display: inline-block; width: ${
                l.width
              }px; max-width: 100%; height: auto; margin: 0 ${Math.round(
                gap / 2,
              )}px; vertical-align: middle; border: 0;" />`,
          )
          .join('')}</div>`
      : '')

  // In a styled band the wordmark is set in caps with wide tracking — it reads
  // as a mark rather than as a heading.
  const wordmarkStyle = styled
    ? `color: ${h.textColor}; font-size: 20px; font-weight: bold; letter-spacing: 3px; text-transform: uppercase;`
    : `color: ${h.textColor}; font-size: 24px; font-weight: bold;`

  const wordmark = `<table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
        <tr>
          <td class="ifg-header-cell" style="vertical-align: middle;">
            <span style="${wordmarkStyle}">${escapeHtml(h.text)}</span>
          </td>${
            h.subtext
              ? `
          <td class="ifg-header-cell" style="vertical-align: middle; padding-left: 10px;">
            <span style="color: ${h.textColor}; font-size: 16px;">${escapeHtml(h.subtext)}</span>
          </td>`
              : ''
          }
        </tr>
      </table>`

  // Vertical gap between the two elements when stacked.
  const stackGap = '<div style="height: 14px; line-height: 14px;">&nbsp;</div>'

  // One line: a centred two-cell table. Tables (not flexbox or inline-block
  // alone) are what hold up across Outlook.
  // `ifg-header-cell` lets the shell's media query stack these on a phone.
  // Side by side, a 375px screen gives each half under 180px — which is how
  // the logos ended up thumbnail-sized and the wordmark wrapped mid-phrase.
  const sideBySide = (left: string, right: string) => `
      <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
        <tr>
          <td class="ifg-header-cell" style="vertical-align: middle;">${left}</td>
          <td class="ifg-header-cell" style="vertical-align: middle; padding-left: ${Math.max(gap, 8)}px;">${right}</td>
        </tr>
      </table>`

  let inner: string
  if (h.mode === 'logos') {
    // Fall back to the wordmark rather than rendering an empty band if the
    // logo row is set but has no usable images.
    inner = logoRow || wordmark
  } else if (h.mode === 'both' && logoRow) {
    switch (h.arrangement) {
      case 'text-top':
        inner = `${wordmark}${stackGap}${logoRow}`
        break
      case 'logos-left':
        inner = sideBySide(logoRow, wordmark)
        break
      case 'text-left':
        inner = sideBySide(wordmark, logoRow)
        break
      default:
        inner = `${logoRow}${stackGap}${wordmark}`
    }
  } else {
    inner = wordmark
  }

  return wrapHeaderBand(h, maybeLink(inner, h.linkUrl))
}

/**
 * Wrap the header lockup in its chosen visual treatment.
 *
 * Everything here is table-and-inline-style only, because this is the first
 * thing Outlook renders and a broken masthead is the most visible failure an
 * email can have. Each style degrades to a solid band rather than to nothing.
 */
function wrapHeaderBand(h: EmailBranding['header'], inner: string): string {
  const style = h.style ?? 'plain'
  const accent = h.accentColor || '#BE1623'

  if (style === 'plain') {
    return `
    <div class="ifg-header-band" style="background-color: ${h.bgColor}; padding: 20px; text-align: center;">
      ${inner}
    </div>
  `
  }

  // A short centred hairline above the strapline. Pure border, no image, so it
  // survives image blocking — which is on by default in Outlook and Gmail
  // until the reader trusts the sender.
  const rule = h.tagline
    ? `<table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 16px auto 0;">
        <tr><td style="width: 56px; border-top: 1px solid rgba(255,255,255,0.28); font-size: 0; line-height: 0;">&nbsp;</td></tr>
      </table>`
    : ''

  // Letter-spacing is ignored by Outlook desktop; it simply reads as normal
  // small caps there, which is a fine outcome rather than a broken one.
  const tagline = h.tagline
    ? `<div class="ifg-tagline" style="margin-top: 12px; color: ${h.textColor}; opacity: 0.72; font-size: 11px; letter-spacing: 2.5px; text-transform: uppercase; font-weight: bold;">${escapeHtml(
        h.tagline,
      )}</div>`
    : ''

  // The closing bar. Three pixels of brand colour is what separates a header
  // from a coloured rectangle.
  const accentBar = `<div style="height: 3px; line-height: 3px; font-size: 0; background-color: ${accent};">&nbsp;</div>`

  const lockup = `${inner}${rule}${tagline}`

  // A hairline of the accent colour at the very top as well as the bar at the
  // bottom. It frames the band, which is what stops a coloured rectangle
  // reading as a coloured rectangle.
  const topRule = `<div style="height: 1px; line-height: 1px; font-size: 0; background-color: ${accent}; opacity: 0.85;">&nbsp;</div>`

  if (style === 'refined') {
    return `
    ${topRule}
    <div class="ifg-header-band" style="background-color: ${h.bgColor}; padding: 34px 24px 30px; text-align: center;">
      ${lockup}
    </div>
    ${accentBar}
  `
  }

  // hero — photograph behind the lockup.
  const image = h.bgImageUrl ? resolveAssetUrl(h.bgImageUrl) : ''
  if (!image) {
    // No photograph chosen: this is 'refined' with deeper padding, not a
    // broken band.
    return `
    <div class="ifg-header-band" style="background-color: ${h.bgColor}; padding: 44px 24px 40px; text-align: center;">
      ${lockup}
    </div>
    ${accentBar}
  `
  }

  // `background` attribute + background-color fallback covers most clients.
  // The VML block is what puts the image behind the lockup in Outlook desktop,
  // which ignores CSS background images entirely.
  //
  // The scrim is a translucent overlay so light photography can't swallow a
  // white wordmark. Outlook cannot composite it, so there the VML image shows
  // undimmed — acceptable, and the reason the photograph should be dark to
  // begin with.
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${h.bgColor};">
      <tr>
        <td background="${escapeHtml(image)}" bgcolor="${h.bgColor}" valign="middle" style="background-color: ${h.bgColor}; background-image: url('${escapeHtml(
          image,
        )}'); background-position: center center; background-size: cover; background-repeat: no-repeat;">
          <!--[if gte mso 9]>
          <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:180px;">
            <v:fill type="frame" src="${escapeHtml(image)}" color="${h.bgColor}" />
            <v:textbox inset="0,0,0,0">
          <![endif]-->
          <div class="ifg-header-band" style="background-color: rgba(15, 23, 42, 0.66); padding: 46px 24px 42px; text-align: center;">
            ${lockup}
          </div>
          <!--[if gte mso 9]>
            </v:textbox>
          </v:rect>
          <![endif]-->
        </td>
      </tr>
    </table>
    ${accentBar}
  `
}

/**
 * The signature / social / logos stack that sits at the bottom of the
 * message body, inside the content cell.
 *
 * Block ids are stable strings rather than random values: this HTML is
 * persisted, and a stable id keeps re-renders byte-identical so a no-op
 * save doesn't churn the stored record.
 */
function renderFooter(b: EmailBranding): string {
  const blocks: EditorBlock[] = []

  if (b.showSignature) {
    blocks.push({ id: 'global-signature', type: 'recruiter_signature', content: b.signature })
  }
  if (b.showDivider) {
    blocks.push({ id: 'global-divider', type: 'divider', content: b.divider })
  }
  if (b.showSocial) {
    blocks.push({ id: 'global-social', type: 'social', content: b.social })
  }
  if (b.showCompany) {
    blocks.push({ id: 'global-company', type: 'company_signature', content: b.company })
  }

  return blocks.map((block) => renderBlock(block)).join('')
}

function renderLegal(b: EmailBranding): string {
  if (!b.showLegal) return ''
  const l = b.legal

  const lines: string[] = []
  if (l.companyName) {
    lines.push(
      `<p style="margin: 0 0 10px 0;">${escapeHtml(l.companyName)}</p>`,
    )
  }
  if (l.addressLine) {
    lines.push(`<p style="margin: 0 0 10px 0;">${escapeHtml(l.addressLine)}</p>`)
  }
  if (l.showUnsubscribe) {
    lines.push(
      `<p style="margin: 0;"><a href="{{unsubscribe_url}}" style="color: ${l.linkColor};">${escapeHtml(
        l.unsubscribeLabel || 'Unsubscribe',
      )}</a></p>`,
    )
  }
  if (lines.length === 0) return ''

  return `
    <div style="background-color: ${l.bgColor}; padding: 20px; text-align: center; font-size: 12px; color: ${l.textColor};">
      ${lines.join('\n      ')}
    </div>
  `
}

/**
 * The header band on its own, for the editor's live preview.
 *
 * Exported so the preview renders the exact HTML that gets emailed. The editor
 * previously carried a hand-built React reimplementation of the header, which
 * drifted the moment the renderer gained a feature — a new style could be
 * selected but not seen.
 */
export function renderHeaderHtml(header: EmailBranding['header']): string {
  return renderHeader({ ...DEFAULT_EMAIL_BRANDING, showHeader: true, header })
}

/** Render every branded region. This is what gets persisted on save. */
export function renderBrandingSlots(branding: EmailBranding): BrandingSlots {
  return {
    header: renderHeader(branding),
    footer: renderFooter(branding),
    legal: renderLegal(branding),
  }
}

/**
 * Substitute rendered branding into an already-built email document.
 *
 * Templates saved by the editor carry all three markers. Anything else —
 * the HTML-imported brochure templates, a campaign body composed inline
 * without a template, or a legacy row from before this feature — has
 * none, so we fall back to appending the footer and legal strips at the
 * end of the document. We never inject a header in the fallback path,
 * because an imported document may already have its own and a duplicate
 * masthead looks worse than none.
 */
export function applyBrandingSlots(html: string, slots: BrandingSlots): string {
  if (!html) return html

  let out = html
  let matchedAny = false

  for (const [key, marker] of Object.entries(BRANDING_MARKERS) as [
    keyof BrandingSlots,
    string,
  ][]) {
    if (out.includes(marker)) {
      matchedAny = true
      out = out.split(marker).join(slots[key] ?? '')
    }
  }

  if (matchedAny) return out

  const tail = `${slots.footer}${slots.legal}`
  if (!tail) return out
  if (/<\/body\s*>/i.test(out)) {
    return out.replace(/<\/body\s*>/i, `${tail}</body>`)
  }
  return out + tail
}

/** Convenience for previews and test sends: render blocks fully branded. */
export function renderTemplateWithBranding(
  blocks: EditorBlock[],
  theme: TemplateTheme | null | undefined,
  branding: EmailBranding,
): string {
  return renderBlocksToHTML(blocks, theme, renderBrandingSlots(branding))
}
