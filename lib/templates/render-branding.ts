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

  const inner =
    h.mode === 'image' && h.logoUrl
      ? `<img src="${escapeHtml(resolveAssetUrl(h.logoUrl))}" alt="${escapeHtml(
          h.text || 'Logo',
        )}" width="${h.logoWidth}" style="display: inline-block; width: ${
          h.logoWidth
        }px; max-width: 100%; height: auto; border: 0;" />`
      : `<table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
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
