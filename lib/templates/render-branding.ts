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
import {
  BRANDING_MARKERS,
  renderBlock,
  renderBlocksToHTML,
  resolveAssetUrl,
  type BrandingSlots,
} from './render-html'

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

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
  const logoRow =
    logos.length > 0
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
      : ''

  const wordmark = `<table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
        <tr>
          <td style="vertical-align: middle;">
            <span style="color: ${h.textColor}; font-size: 24px; font-weight: bold;">${escapeHtml(
              h.text,
            )}</span>
          </td>${
            h.subtext
              ? `
          <td style="vertical-align: middle; padding-left: 10px;">
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
  const sideBySide = (left: string, right: string) => `
      <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
        <tr>
          <td style="vertical-align: middle;">${left}</td>
          <td style="vertical-align: middle; padding-left: ${Math.max(gap, 8)}px;">${right}</td>
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

  return `
    <div style="background-color: ${h.bgColor}; padding: 20px; text-align: center;">
      ${maybeLink(inner, h.linkUrl)}
    </div>
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
