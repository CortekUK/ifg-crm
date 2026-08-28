import type {
  BrochureBlockContent,
  SectionBlockContent,
  EditorBlock,
  TextBlockContent,
  ImageBlockContent,
  ButtonBlockContent,
  DividerBlockContent,
  SpacerBlockContent,
  VideoBlockContent,
  SocialBlockContent,
  HTMLBlockContent,
  ColumnsBlockContent,
  ConditionalBlockContent,
  RecruiterSignatureBlockContent,
  CompanySignatureBlockContent,
  FileBlockContent,
  HeroBlockContent,
  CardsBlockContent,
  CardItem,
  QuoteBlockContent,
  TemplateTheme,
  ThemeFont,
  ThemeCorners,
  ThemeRhythm,
} from './editor-types'
// socialIconSvg used to be imported here for inline-SVG embedding, but
// renderSocialBlock now uses externally-hosted icons via simpleicons.org
// (Gmail strips inline SVG). The registry of platforms is still the
// single source of truth for which keys are renderable.
import { SOCIAL_PLATFORMS } from './social-icons'
import { brochureEmailUrl } from '@/lib/config/site-url'

// Default chrome colours when no theme is set on the template. Single
// source of truth — `EditorCanvas` mirrors these values so the canvas
// preview stays byte-identical to what the recipient gets.
export const DEFAULT_THEME: Required<TemplateTheme> = {
  headerBgColor: '#0f172a',
  headerTextColor: '#ffffff',
  footerBgColor: '#f3f4f6',
  footerTextColor: '#6b7280',
  footerLinkColor: '#3b82f6',
  pageBgColor: '#f9fafb',
  bodyBgColor: '#ffffff',

  primaryColor: '#BE1623',
  inkColor: '#0f172a',
  mutedColor: '#6b7280',

  headingFont: 'system',
  bodyFont: 'system',
  baseFontSize: 16,
  headingScale: 1,

  corners: 'soft',
  rhythm: 'comfortable',
}

/**
 * Font stacks. Each ends in a websafe face on purpose: webfonts are ignored by
 * Outlook and much of mobile, so the fallback is what a large share of readers
 * see and it has to look intentional on its own.
 */
const FONT_STACKS: Record<ThemeFont, string> = {
  system:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  modern: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  classic: "Georgia, 'Times New Roman', Times, serif",
  editorial: "'Playfair Display', Georgia, 'Times New Roman', serif",
  condensed: "'Oswald', 'Arial Narrow', Arial, sans-serif",
  mono: "'Space Mono', 'Courier New', Courier, monospace",
}

/**
 * Google Fonts stylesheets for the stacks that name a webfont. Only loaded for
 * the fonts actually chosen, and only for clients that support them.
 */
const WEBFONT_HREF: Partial<Record<ThemeFont, string>> = {
  modern: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap',
  editorial:
    'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&display=swap',
  condensed: 'https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&display=swap',
  mono: 'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap',
}

/**
 * Escape text destined for an HTML attribute or text node.
 *
 * Lives here rather than in render-branding because both modules need it and
 * render-branding already imports from this one — putting it the other way
 * round would make the two files circular.
 */
export function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function fontStack(font: ThemeFont | undefined): string {
  return FONT_STACKS[font ?? 'system'] ?? FONT_STACKS.system
}

/** Button and panel corner radius, in px. Outlook squares these off regardless. */
export function cornerRadius(corners: ThemeCorners | undefined): number {
  return corners === 'square' ? 0 : corners === 'pill' ? 999 : 8
}

/**
 * Padding inside the content cell, and the EXTRA gap between blocks.
 *
 * `block` is a delta, not the whole gap: every block already carries its own
 * top and bottom padding, so this is added on top of that. It was previously
 * the full gap and went unused entirely — "airy" and "compact" differed only
 * in the padding around the outside, which is why changing the setting looked
 * like it did nothing.
 */
export function rhythmSpacing(rhythm: ThemeRhythm | undefined): {
  cell: number
  block: number
} {
  if (rhythm === 'compact') return { cell: 16, block: 0 }
  if (rhythm === 'airy') return { cell: 32, block: 16 }
  return { cell: 24, block: 6 }
}

/**
 * Spacer between two blocks. A table row rather than a margin: Outlook
 * collapses margins on block elements, so a gap expressed that way silently
 * disappears for a large share of readers.
 */
export function blockGapHtml(gap: number): string {
  if (gap <= 0) return ''
  return `<div style="height: ${gap}px; line-height: ${gap}px; font-size: 0;">&nbsp;</div>`
}

// Resolve a theme + falls back to defaults for any unset key. Used by
// both the email renderer and the canvas component.
export function resolveTheme(theme?: TemplateTheme | null): Required<TemplateTheme> {
  return { ...DEFAULT_THEME, ...(theme ?? {}) }
}

/**
 * Placeholders the shell emits in place of the globally-branded regions.
 * A saved `email_templates.body_html` keeps these markers verbatim; the
 * send path swaps them for the current branding HTML immediately before
 * running merge tags (see `lib/templates/render-branding.ts` and the Deno
 * mirror `supabase/functions/_shared/branding.ts`).
 *
 * Keeping them as HTML comments means a template whose branding is never
 * substituted still renders as valid, sane email — the regions are simply
 * absent rather than showing raw placeholder text to a recipient.
 */
export const BRANDING_MARKERS = {
  header: '<!--IFG_GLOBAL_HEADER-->',
  footer: '<!--IFG_GLOBAL_FOOTER-->',
  legal: '<!--IFG_GLOBAL_LEGAL-->',
} as const

/** Rendered HTML for each globally-branded region. */
export interface BrandingSlots {
  header: string
  footer: string
  legal: string
}

/**
 * Render the email shell around a template's blocks.
 *
 * `slots` is optional and deliberately takes already-rendered HTML rather
 * than the branding config: `render-branding.ts` imports `renderBlock`
 * from this module, so accepting the config here would create an import
 * cycle. Omit it (the save path) to bake in the markers; pass rendered
 * slots (previews, test sends) to see the finished email.
 */
export function renderBlocksToHTML(
  blocks: EditorBlock[],
  theme?: TemplateTheme | null,
  slots?: BrandingSlots,
  /**
   * `globalBranding: false` emits no marker comments at all, so the send path
   * has nothing to substitute and the template's own blocks ARE the header and
   * the footer.
   *
   * A designed email cannot share a masthead with every other template — the
   * band that suits a plain letter fights a poster. The trade is that such a
   * template owns its own compliance: the unsubscribe link and the company
   * details have to be in its blocks, because the global legal strip is gone
   * with everything else.
   */
  options: { globalBranding?: boolean } = {},
): string {
  const t = resolveTheme(theme)
  const gap = blockGapHtml(rhythmSpacing(t.rhythm).block)
  const activeSlots: BrandingSlots | undefined =
    options.globalBranding === false ? { header: '', footer: '', legal: '' } : slots

  // Blocks are grouped into runs. A run of ordinary blocks shares one padded
  // cell — which is what the whole email used to be. A full-bleed block gets
  // a row of its own with no padding at all, so it can reach the edges.
  //
  // The grouping is what makes designed layouts possible: a band of colour or
  // a photograph that runs edge to edge is the difference between these
  // templates and the same white card every time. A template with no
  // full-bleed blocks produces exactly the markup it did before.
  // Nothing full-bleed: take the original single-cell path, byte for byte.
  // Every template that predates this feature renders exactly as it did, so
  // the new capability cannot disturb 27 live emails.
  if (!blocks.some(isFullBleed)) {
    return renderEmailShell(
      blocks.map((block) => renderBlock(block, theme)).join(gap),
      theme,
      activeSlots,
    )
  }

  const runs: { bleed: boolean; html: string[] }[] = []
  for (const block of blocks) {
    const bleed = isFullBleed(block)
    const last = runs[runs.length - 1]
    if (last && last.bleed === bleed && !bleed) {
      last.html.push(renderBlock(block, theme))
    } else {
      runs.push({ bleed, html: [renderBlock(block, theme)] })
    }
  }

  const spacing = rhythmSpacing(t.rhythm)
  const body = runs
    .map((run) =>
      run.bleed
        ? run.html.join('')
        : `<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td class="ifg-content-cell" style="padding: ${spacing.cell}px; font-family: ${fontStack(
            t.bodyFont,
          )}; color: ${t.inkColor};">${run.html.join(gap)}</td></tr></table>`,
    )
    .join('')

  return renderEmailShell(body, theme, activeSlots, { padded: false })
}

/** Does this block reach the edges of the email, ignoring the content padding? */
function isFullBleed(block: EditorBlock): boolean {
  if (block.type === 'section') return true
  if (block.type === 'hero') return block.content?.fullBleed === true
  if (block.type === 'image') return block.content?.fullBleed === true
  return false
}

/**
 * Wrap already-rendered body HTML in the standard email document.
 *
 * Split out of `renderBlocksToHTML` so content that never came from the
 * block editor can share the exact same shell — the three `Brochure:`
 * templates were imported as bare `<div>` fragments with no `<html>`,
 * no `<body>` and no branding markers, so they rendered without the
 * masthead in every preview and went out unbranded and unconstrained in
 * width. There must be one definition of this shell, not two.
 */
export function renderEmailShell(
  body: string,
  theme?: TemplateTheme | null,
  slots?: BrandingSlots,
  /**
   * `padded: false` means the caller has already wrapped its content in the
   * cells it wants — used by renderBlocksToHTML so full-bleed blocks can sit
   * outside the padding. Everything else (imported HTML, the brochure
   * templates) still gets the single padded cell it always had.
   */
  options: { padded?: boolean } = {},
): string {
  const t = resolveTheme(theme)
  const s: BrandingSlots = slots ?? BRANDING_MARKERS
  const bodyStack = fontStack(t.bodyFont)
  const spacing = rhythmSpacing(t.rhythm)

  // Webfonts are a progressive enhancement: Gmail and Apple Mail honour the
  // link, Outlook ignores it and uses the stack's websafe fallback. The
  // @import is wrapped so Outlook's parser never sees it — it chokes on
  // @import inside a conditional-free <style> and can drop the whole block.
  // A face used inline by a block — a mono label, say — isn't the theme's
  // heading or body font, so it wouldn't otherwise be requested and would
  // silently fall back. Cheap to check the body for it; the alternative is a
  // design that looks right locally and arrives in Courier.
  const hrefs = [WEBFONT_HREF[t.headingFont], WEBFONT_HREF[t.bodyFont]]
  if (body.includes('Space Mono') && !hrefs.includes(WEBFONT_HREF.mono)) {
    hrefs.push(WEBFONT_HREF.mono)
  }
  const fontLink = hrefs.filter(Boolean).length
    ? `<!--[if !mso]><!-->
  ${[...new Set(hrefs.filter(Boolean))]
    .map((href) => `<link href="${href}" rel="stylesheet" type="text/css">`)
    .join('\n  ')}
  <!--<![endif]-->`
    : ''

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>{{subject}}</title>
  ${fontLink}
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
  <style type="text/css">
    /* Responsive rules — fire when the email lands in a viewport
       narrower than the 600px shell. Apple Mail / Gmail-mobile / iframe
       previews honour these; Outlook desktop ignores them and falls
       back to the mso 600px width below. */
    img { max-width: 100% !important; height: auto !important; }
    table { border-collapse: collapse; }
    @media only screen and (max-width: 600px) {
      .ifg-shell { width: 100% !important; max-width: 100% !important; }
      .ifg-content-cell { padding: 14px !important; }
      .ifg-co-logo {
        width: 80px !important;
        max-width: 30% !important;
        margin: 4px 6px !important;
      }
      /* Logos were capped at 40% of a cell that was itself half a phone
         screen — under 70px, which is where "too small to read" comes from.
         Stacked (below), each logo has the full width, and sizing by height
         makes marks of different proportions match each other. */
      .ifg-header-logo {
        width: auto !important;
        max-width: 46% !important;
        max-height: 44px !important;
        margin: 0 8px !important;
      }
      /* The masthead stacks: logos on one line, wordmark under it. */
      .ifg-header-cell {
        display: block !important;
        width: 100% !important;
        text-align: center !important;
        padding-left: 0 !important;
        padding-bottom: 8px !important;
      }
      .ifg-header-band {
        padding: 24px 16px 22px !important;
      }
      /* Wide tracking on a narrow screen breaks the strapline across lines
         in the middle of a word. */
      .ifg-tagline {
        font-size: 10px !important;
        letter-spacing: 1.2px !important;
      }
      .ifg-social a { margin: 0 3px !important; }
      /* Bands and poster type both need reining in on a phone: 52px display
         type on a 375px screen fits about two words to a line. */
      .ifg-band { padding: 28px 18px !important; }
      .ifg-display { font-size: 34px !important; line-height: 1.06 !important; }
      .ifg-eyebrow { letter-spacing: 1.6px !important; }
      /* Side-by-side panels are unreadable at phone width; stack them. */
      .ifg-card {
        display: block !important;
        width: 100% !important;
        padding: 0 0 12px 0 !important;
      }
    }
  </style>
</head>
  <!-- bgcolor as well as CSS: Outlook's Word engine drops
       style="background-color" on the outer table often enough that a dark
       page background would show white for those readers alone. -->
<body bgcolor="${t.pageBgColor}" style="margin: 0; padding: 0; font-family: ${bodyStack}; font-size: ${t.baseFontSize}px; color: ${t.inkColor}; background-color: ${t.pageBgColor};">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${t.pageBgColor}" style="background-color: ${t.pageBgColor};">
    <tr>
      <td align="center">
        <!--[if mso]>
        <table cellpadding="0" cellspacing="0" border="0" width="600" align="center" bgcolor="${t.bodyBgColor}" style="background-color: ${t.bodyBgColor};">
          <tr><td>
        <![endif]-->
        <table class="ifg-shell" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${t.bodyBgColor}" style="max-width: 600px; margin: 0 auto; background-color: ${t.bodyBgColor};">
          <tr>
            <td>
              ${s.header}
            </td>
          </tr>
          <tr>
            <td${
              options.padded === false
                ? ''
                : ` class="ifg-content-cell" style="padding: ${spacing.cell}px; font-family: ${bodyStack}; color: ${t.inkColor};"`
            }>
              ${body}${
                options.padded === false
                  ? `<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td class="ifg-content-cell" style="padding: 0 ${spacing.cell}px ${spacing.cell}px;">${s.footer}</td></tr></table>`
                  : s.footer
              }
            </td>
          </tr>
          <tr>
            <td>
              ${s.legal}
            </td>
          </tr>
        </table>
        <!--[if mso]>
          </td></tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

// Exported so `render-branding.ts` can render the global signature, divider,
// social and company sections through these exact renderers rather than
// keeping a second copy of the markup in sync.
export function renderBlock(block: EditorBlock, theme?: TemplateTheme | null): string {
  // Optional so `render-branding.ts` can keep calling this for the signature,
  // divider, social and company sections without threading a theme it doesn't
  // have; those sections carry their own colours.
  const t = resolveTheme(theme)
  switch (block.type) {
    case 'brochure':
      return renderBrochureBlock(block.content as BrochureBlockContent, t)
    case 'section':
      return renderSectionBlock(block.content as SectionBlockContent, t)
    case 'text':
      return renderTextBlock(block.content as TextBlockContent, t)
    case 'image':
      return renderImageBlock(block.content as ImageBlockContent)
    case 'button':
      return renderButtonBlock(block.content as ButtonBlockContent, t)
    case 'hero':
      return renderHeroBlock(block.content as HeroBlockContent, t)
    case 'cards':
      return renderCardsBlock(block.content as CardsBlockContent, t)
    case 'quote':
      return renderQuoteBlock(block.content as QuoteBlockContent, t)
    case 'divider':
      return renderDividerBlock(block.content as DividerBlockContent)
    case 'spacer':
      return renderSpacerBlock(block.content as SpacerBlockContent)
    case 'video':
      return renderVideoBlock(block.content as VideoBlockContent)
    case 'social':
      return renderSocialBlock(block.content as SocialBlockContent)
    case 'html':
      return renderHTMLBlock(block.content as HTMLBlockContent)
    case 'columns':
      return renderColumnsBlock(block.content as ColumnsBlockContent, t)
    case 'conditional':
      return renderConditionalBlock(block.content as ConditionalBlockContent, t)
    case 'recruiter_signature':
      return renderRecruiterSignatureBlock(block.content as RecruiterSignatureBlockContent)
    case 'company_signature':
      return renderCompanySignatureBlock(block.content as CompanySignatureBlockContent)
    case 'file':
      return renderFileBlock(block.content as FileBlockContent)
    default:
      return ''
  }
}

function renderTextBlock(content: TextBlockContent, t: Required<TemplateTheme>): string {
  const base = t.baseFontSize
  const fontSize = content.fontSize === 'small' ? Math.round(base * 0.875)
    : content.fontSize === 'large' ? Math.round(base * 1.125)
    : content.fontSize === 'xlarge' ? Math.round(base * 1.5)
    : base
  const bgStyle = content.backgroundColor ? `background-color: ${content.backgroundColor};` : ''

  return `
    <div style="text-align: ${content.alignment}; padding-top: ${content.paddingTop}px; padding-bottom: ${content.paddingBottom}px; font-family: ${fontStack(
      t.bodyFont,
    )}; font-size: ${fontSize}px; line-height: 1.6; color: ${t.inkColor}; ${bgStyle}">
      ${styleHeadings(content.html, t)}
    </div>
  `
}

/**
 * Inline the theme's heading treatment onto h1/h2/h3 in a text block.
 *
 * A `<style>` block in the head would be tidier, but Outlook's Word engine
 * applies its own heading sizes and ignores much of it — the headings that
 * carry the design would be the ones that break. Rewriting the tags is
 * deterministic and lands everywhere.
 *
 * Only tags with no `style` of their own are touched, so a heading someone
 * has deliberately coloured or resized is left exactly as they left it.
 */
function styleHeadings(html: string, t: Required<TemplateTheme>): string {
  if (!html) return html
  const scale = t.headingScale || 1
  const sizes: Record<string, number> = {
    h1: Math.round(t.baseFontSize * 2.125 * scale),
    h2: Math.round(t.baseFontSize * 1.625 * scale),
    h3: Math.round(t.baseFontSize * 1.25 * scale),
  }

  return html.replace(/<(h[123])(\s*)>/gi, (_m, tag: string) => {
    const size = sizes[tag.toLowerCase()]
    return `<${tag} style="margin: 0 0 12px; font-family: ${fontStack(
      t.headingFont,
    )}; font-size: ${size}px; line-height: 1.25; font-weight: bold; color: ${t.inkColor};">`
  })
}

function renderImageBlock(content: ImageBlockContent): string {
  if (!content.src) {
    return `
      <div style="text-align: ${content.alignment}; padding: 10px 0;">
        <div style="background-color: #f3f4f6; border: 2px dashed #d1d5db; padding: 40px; text-align: center; color: #6b7280;">
          Image placeholder
        </div>
      </div>
    `
  }

  const widthStyle = content.width === 'auto' ? '' : `width: ${content.width}%; max-width: 100%;`
  // Resolve relative paths to absolute / data URLs so emails render
  // even when the recipient's mail client can't fetch from / on the IFG
  // domain (which is most of them).
  const radius = content.radius ? `border-radius: ${content.radius}px;` : ''
  // Full bleed means the image supplies its own edge: no padding around it,
  // and it fills the width of the email rather than the width of the cell.
  const bleedStyle = content.fullBleed ? 'width: 100%;' : widthStyle
  const img = `<img src="${resolveAssetUrl(content.src)}" alt="${content.alt}" style="${bleedStyle} height: auto; display: block; ${radius}" />`

  const imageContent = content.linkUrl ? `<a href="${content.linkUrl}" target="_blank">${img}</a>` : img

  return `
    <div style="text-align: ${content.alignment}; padding: ${content.fullBleed ? '0' : '10px 0'};">
      ${imageContent}
    </div>
  `
}

function renderButtonBlock(content: ButtonBlockContent, t: Required<TemplateTheme>): string {
  const widthStyle = content.width === 'full' ? 'display: block; width: 100%; text-align: center;' : 'display: inline-block;'

  // The brand colour and corner style come from the theme, so changing them
  // once restyles every button in every template — which is the whole point of
  // having a theme. A button that sets `customColour` keeps its own, for the
  // occasional secondary or destructive action.
  const bg = content.customColour ? content.backgroundColor : t.primaryColor
  const radius = content.customColour ? content.borderRadius : cornerRadius(t.corners)

  // Outline: a hollow pill, border and label in the accent colour. The
  // reference designs use it wherever a solid block of colour would be too
  // heavy — a second action, or a CTA sitting on a photograph.
  const outline = content.variant === 'outline'
  const fill = outline ? 'transparent' : bg
  const label = outline ? bg : content.textColor
  const border = outline ? `border: 2px solid ${bg};` : ''

  return `
    <div style="text-align: ${content.alignment}; padding-top: ${content.paddingTop}px; padding-bottom: ${content.paddingBottom}px;">
      <a href="${content.url}" target="_blank" style="${widthStyle} background-color: ${fill}; ${border} color: ${label}; padding: ${content.paddingY || 12}px ${content.paddingX || 24}px; text-decoration: none; border-radius: ${radius}px; font-family: ${fontStack(
        t.bodyFont,
      )}; font-weight: bold; font-size: ${Math.round(t.baseFontSize)}px;">
        ${content.text}
      </a>
    </div>
  `
}

/**
 * A brochure shown as a book that opens the real flipbook.
 *
 * The cover is built from table cells rather than an image with a border:
 * a thin dark spine down the left, the cover itself, then two hairline page
 * edges on the right. Email clients that block images still show the shape and
 * the title, so the block never collapses to nothing.
 */
function renderBrochureBlock(content: BrochureBlockContent, t: Required<TemplateTheme>): string {
  if (!content.slug) {
    return `<div style="padding: 16px; border: 1px dashed ${t.mutedColor}; text-align: center; font-family: ${fontStack(
      t.bodyFont,
    )}; font-size: 14px; color: ${t.mutedColor};">Pick a brochure</div>`
  }

  const url = brochureEmailUrl(content.slug)
  const radius = Math.min(cornerRadius(t.corners), 10)
  const cover = content.coverImage ? resolveAssetUrl(content.coverImage) : ''
  const spine = t.primaryColor

  const meta =
    content.showPageCount && content.pageCount
      ? `<div style="margin-top: 6px; font-family: ${fontStack(t.bodyFont)}; font-size: ${Math.round(
          t.baseFontSize * 0.75,
        )}px; letter-spacing: 1.5px; text-transform: uppercase; color: ${t.mutedColor};">${
          content.pageCount
        } pages · flip through it online</div>`
      : ''

  const book = cover
    ? `<table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
        <tr>
          <td style="width: 6px; background-color: ${spine}; border-radius: ${radius}px 0 0 ${radius}px; font-size: 0; line-height: 0;">&nbsp;</td>
          <td style="line-height: 0;">
            <a href="${escapeHtml(url)}" target="_blank"><img src="${escapeHtml(
              cover,
            )}" alt="${escapeHtml(content.title)}" width="200" style="display: block; width: 200px; max-width: 100%; height: auto; border: 0;" /></a>
          </td>
          <!-- The stacked page edges. Two thin cells, lighter each step. -->
          <td style="width: 3px; background-color: #d9dde3; font-size: 0; line-height: 0;">&nbsp;</td>
          <td style="width: 2px; background-color: #eef1f5; border-radius: 0 ${radius}px ${radius}px 0; font-size: 0; line-height: 0;">&nbsp;</td>
        </tr>
      </table>`
    : ''

  const copy = `
    <div style="font-family: ${fontStack(t.headingFont)}; font-size: ${Math.round(
      t.baseFontSize * 1.375,
    )}px; font-weight: bold; color: ${t.inkColor};">${escapeHtml(content.title)}</div>
    ${
      content.description
        ? `<div style="margin-top: 8px; font-family: ${fontStack(t.bodyFont)}; font-size: ${Math.round(
            t.baseFontSize * 0.9375,
          )}px; line-height: 1.55; color: ${t.mutedColor};">${escapeHtml(content.description)}</div>`
        : ''
    }
    ${meta}
    <div style="margin-top: 16px;">
      <a href="${escapeHtml(url)}" target="_blank" style="display: inline-block; background-color: ${
        t.primaryColor
      }; color: #ffffff; padding: 12px 26px; text-decoration: none; border-radius: ${cornerRadius(
        t.corners,
      )}px; font-family: ${fontStack(t.bodyFont)}; font-weight: bold; font-size: ${Math.round(
        t.baseFontSize * 0.9375,
      )}px;">${escapeHtml(content.buttonText || 'Open the brochure')}</a>
    </div>`

  const pad = `padding-top: ${content.paddingTop}px; padding-bottom: ${content.paddingBottom}px;`

  // Side by side on a desktop, stacked on a phone through the shared
  // .ifg-card rule the panels already use.
  if (content.layout === 'wide' && book) {
    return `
    <div style="${pad}">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="table-layout: fixed;">
        <tr>
          <td class="ifg-card" width="42%" valign="top" style="padding-right: 18px;">${book}</td>
          <td class="ifg-card" width="58%" valign="top">${copy}</td>
        </tr>
      </table>
    </div>`
  }

  return `
    <div style="${pad} text-align: center;">
      ${book}
      <div style="margin-top: 18px;">${copy}</div>
    </div>`
}

/**
 * A full-width band with its own background and its own text colour.
 *
 * The children are rendered with a DERIVED theme rather than being restyled
 * individually: a dark band sets `textColor`, and every heading, paragraph and
 * caption inside it picks that up through the ink colour the block renderers
 * already read. That is what makes a dark section one decision instead of
 * fifteen.
 */
function renderSectionBlock(content: SectionBlockContent, t: Required<TemplateTheme>): string {
  const inner: Required<TemplateTheme> = {
    ...t,
    inkColor: content.textColor || t.inkColor,
    mutedColor: content.mutedColor || t.mutedColor,
  }

  const gap = blockGapHtml(rhythmSpacing(t.rhythm).block)
  const body = (content.children ?? [])
    .map((child) => renderBlock(child, inner))
    .join(gap)

  const padY = content.paddingY ?? 36
  const padX = content.paddingX ?? 24
  const bg = content.backgroundColor || t.bodyBgColor
  const image = content.backgroundImageUrl ? resolveAssetUrl(content.backgroundImageUrl) : ''

  if (!image) {
    return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${bg}" style="background-color: ${bg};">
      <tr><td class="ifg-band" style="padding: ${padY}px ${padX}px;">${body}</td></tr>
    </table>`
  }

  // Same VML treatment as the hero: Outlook cannot paint a CSS background
  // image, so the band would otherwise be a flat colour there.
  const scrim = `rgba(0, 0, 0, ${Math.min(100, Math.max(0, content.overlayOpacity ?? 0)) / 100})`
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${bg}" style="background-color: ${bg};">
      <tr>
        <td background="${escapeHtml(image)}" bgcolor="${bg}" valign="middle" style="background-color: ${bg}; background-image: url('${escapeHtml(
          image,
        )}'); background-position: center center; background-size: cover; background-repeat: no-repeat;">
          <!--[if gte mso 9]>
          <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:400px;">
            <v:fill type="frame" src="${escapeHtml(image)}" color="${bg}" />
            <v:textbox inset="0,0,0,0">
          <![endif]-->
          <div class="ifg-band" style="background-color: ${scrim}; padding: ${padY}px ${padX}px;">${body}</div>
          <!--[if gte mso 9]>
            </v:textbox>
          </v:rect>
          <![endif]-->
        </td>
      </tr>
    </table>`
}

/**
 * Hero: a photograph with a headline and CTA over it.
 *
 * Outlook's Word engine cannot place content over a CSS background image, so
 * the whole lockup is repeated inside a VML rect. Everywhere else the CSS
 * background does the work and the VML is ignored.
 */
function renderHeroBlock(content: HeroBlockContent, t: Required<TemplateTheme>): string {
  const img = content.imageUrl ? resolveAssetUrl(content.imageUrl) : ''
  const pad = content.height === 'short' ? 36 : content.height === 'tall' ? 84 : 60
  const vmlHeight = content.height === 'short' ? 200 : content.height === 'tall' ? 380 : 290
  const align = content.alignment === 'left' ? 'left' : 'center'
  // The scrim darkens the photo so white type stays legible on a light image.
  const scrim = `rgba(0, 0, 0, ${Math.min(100, Math.max(0, content.overlayOpacity ?? 55)) / 100})`
  const radius = cornerRadius(t.corners)

  // Display sets the headline at poster size — the single biggest difference
  // between a designed email and a formatted one.
  const giant = content.size === 'giant'
  const display = giant || content.size === 'display'
  const headingPx = Math.round(
    t.baseFontSize * (giant ? 5.5 : display ? 3.25 : 2) * (t.headingScale || 1),
  )

  const eyebrow = content.eyebrow
    ? `<div class="ifg-eyebrow" style="margin-bottom: 12px; font-family: ${fontStack(
        t.bodyFont,
      )}; font-size: ${Math.round(t.baseFontSize * 0.6875)}px; letter-spacing: 2.5px; text-transform: uppercase; font-weight: bold; color: ${
        content.textColor
      }; opacity: 0.75;">${escapeHtml(content.eyebrow)}</div>`
    : ''

  const heading = content.heading
    ? `<div class="ifg-display" style="font-family: ${fontStack(
        t.headingFont,
      )}; font-size: ${headingPx}px; line-height: ${display ? '1.02' : '1.2'}; font-weight: bold; ${
        display ? 'letter-spacing: -0.5px; text-transform: uppercase;' : ''
      } color: ${content.textColor};">${escapeHtml(content.heading)}</div>`
    : ''

  const sub = content.subheading
    ? `<div style="margin-top: 10px; font-family: ${fontStack(t.bodyFont)}; font-size: ${Math.round(
        t.baseFontSize * 1.05,
      )}px; line-height: 1.5; color: ${content.textColor}; opacity: 0.9;">${escapeHtml(
        content.subheading,
      )}</div>`
    : ''

  const cta =
    content.buttonText && content.buttonUrl
      ? `<div style="margin-top: 20px;"><a href="${escapeHtml(
          content.buttonUrl,
        )}" target="_blank" style="display: inline-block; background-color: ${t.primaryColor}; color: #ffffff; padding: 13px 28px; text-decoration: none; border-radius: ${radius}px; font-family: ${fontStack(
          t.bodyFont,
        )}; font-weight: bold; font-size: ${t.baseFontSize}px;">${escapeHtml(
          content.buttonText,
        )}</a></div>`
      : ''

  const lockup = `<div style="text-align: ${align};">${eyebrow}${heading}${sub}${cta}</div>`

  if (!img) {
    // No photograph: a solid panel. `backgroundColor` lets a design use this
    // as a band of display type in any colour — without it the panel was
    // always the ink colour, which is white in a dark design.
    const panel = content.backgroundColor || t.inkColor
    return `<div class="ifg-band" style="background-color: ${panel}; padding: ${pad}px 24px;">${lockup}</div>`
  }

  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${t.inkColor};">
      <tr>
        <td background="${escapeHtml(img)}" bgcolor="${t.inkColor}" valign="middle" style="background-color: ${t.inkColor}; background-image: url('${escapeHtml(
          img,
        )}'); background-position: center center; background-size: cover; background-repeat: no-repeat;">
          <!--[if gte mso 9]>
          <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:560px;height:${vmlHeight}px;">
            <v:fill type="frame" src="${escapeHtml(img)}" color="${t.inkColor}" />
            <v:textbox inset="0,0,0,0">
          <![endif]-->
          <div style="background-color: ${scrim}; padding: ${pad}px 24px;">
            ${lockup}
          </div>
          <!--[if gte mso 9]>
            </v:textbox>
          </v:rect>
          <![endif]-->
        </td>
      </tr>
    </table>
  `
}

/**
 * Two or three panels side by side.
 *
 * A table, not flexbox or inline-block: Outlook supports neither reliably.
 * `.ifg-card` in the shell's media query drops them to full width on a phone.
 */
function renderCardsBlock(content: CardsBlockContent, t: Required<TemplateTheme>): string {
  const items = (content.items ?? []).filter((i) => i.title || i.body)
  if (items.length === 0) return ''

  const cols = Math.min(content.columns || 2, items.length)
  const radius = cornerRadius(t.corners)
  const gap = 12

  const cell = (item: CardItem) => `
    <td class="ifg-card" width="${Math.floor(100 / cols)}%" valign="top" style="padding: 0 ${gap / 2}px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${content.backgroundColor}; border: 1px solid ${content.borderColor}; border-radius: ${radius}px;">
        <tr>
          <td style="padding: 18px;">
            ${
              item.icon
                ? `<div style="font-size: 22px; line-height: 1; margin-bottom: 8px;">${escapeHtml(item.icon)}</div>`
                : ''
            }
            <div style="font-family: ${fontStack(t.headingFont)}; font-size: ${Math.round(
              t.baseFontSize * 1.0625,
            )}px; font-weight: bold; color: ${t.inkColor}; margin-bottom: 6px;">${escapeHtml(
              item.title,
            )}</div>
            <div style="font-family: ${fontStack(t.bodyFont)}; font-size: ${Math.round(
              t.baseFontSize * 0.875,
            )}px; line-height: 1.55; color: ${t.mutedColor};">${escapeHtml(item.body)}</div>
          </td>
        </tr>
      </table>
    </td>`

  return `
    <div style="padding-top: ${content.paddingTop}px; padding-bottom: ${content.paddingBottom}px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="table-layout: fixed;">
        <tr>${items.slice(0, cols).map(cell).join('')}</tr>
      </table>
    </div>
  `
}

/** A pull quote, or a headline statistic. */
function renderQuoteBlock(content: QuoteBlockContent, t: Required<TemplateTheme>): string {
  const accent = content.accentColor || t.primaryColor
  const bg = content.backgroundColor ? `background-color: ${content.backgroundColor};` : ''
  const isStat = content.variant === 'stat'

  const body = isStat
    ? `<div style="font-family: ${fontStack(t.headingFont)}; font-size: ${Math.round(
        t.baseFontSize * 2.5 * (t.headingScale || 1),
      )}px; line-height: 1.1; font-weight: bold; color: ${accent};">${escapeHtml(content.text)}</div>`
    : `<div style="font-family: ${fontStack(t.headingFont)}; font-size: ${Math.round(
        t.baseFontSize * 1.375,
      )}px; line-height: 1.45; font-style: italic; color: ${t.inkColor};">${escapeHtml(
        content.text,
      )}</div>`

  const attribution = content.attribution
    ? `<div style="margin-top: 10px; font-family: ${fontStack(t.bodyFont)}; font-size: ${Math.round(
        t.baseFontSize * 0.8125,
      )}px; color: ${t.mutedColor}; text-transform: uppercase; letter-spacing: 1px;">${escapeHtml(
        content.attribution,
      )}</div>`
    : ''

  // A left rule rather than a quotation glyph — it holds up at any size and
  // needs no font support.
  return `
    <div style="padding-top: ${content.paddingTop}px; padding-bottom: ${content.paddingBottom}px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="${bg}">
        <tr>
          <td width="4" style="background-color: ${accent}; font-size: 0; line-height: 0;">&nbsp;</td>
          <td style="padding: 4px 0 4px 18px;">
            ${body}
            ${attribution}
          </td>
        </tr>
      </table>
    </div>
  `
}

function renderDividerBlock(content: DividerBlockContent): string {
  return `
    <div style="padding-top: ${content.paddingTop}px; padding-bottom: ${content.paddingBottom}px;">
      <hr style="border: none; border-top: ${content.thickness}px ${content.style} ${content.color}; margin: 0;" />
    </div>
  `
}

function renderSpacerBlock(content: SpacerBlockContent): string {
  return `<div style="height: ${content.height}px;"></div>`
}

function renderVideoBlock(content: VideoBlockContent): string {
  if (!content.url) {
    return `
      <div style="text-align: ${content.alignment}; padding: 10px 0;">
        <div style="background-color: #0f172a; padding: 60px 40px; text-align: center; color: white;">
          <span style="font-size: 48px;">▶</span>
          <p style="margin: 10px 0 0 0;">Video placeholder</p>
        </div>
      </div>
    `
  }

  // Extract video ID and generate thumbnail
  const thumbnailUrl = content.thumbnailUrl || getVideoThumbnail(content.url)
  const videoWidth = content.width === 'full' ? '100%' : `${content.width}px`

  return `
    <div style="text-align: ${content.alignment}; padding: 10px 0;">
      <a href="${content.url}" target="_blank" style="text-decoration: none;">
        <!--[if mso]>
        <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:338px;">
          <v:fill type="frame" src="${thumbnailUrl}" />
          <v:textbox inset="0,0,0,0" style="mso-fit-shape-to-text:true">
        <![endif]-->
        <table cellpadding="0" cellspacing="0" border="0" width="${videoWidth}" style="max-width: ${videoWidth}; background-image: url('${thumbnailUrl}'); background-size: cover; background-position: center;">
          <tr>
            <td align="center" valign="middle" style="padding: 60px 0; text-align: center;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" valign="middle" width="60" height="60" style="width: 60px; height: 60px; background-color: #000000; border-radius: 50%; text-align: center; vertical-align: middle; font-size: 24px; color: #ffffff; opacity: 0.8;">
                    &#9654;
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <!--[if mso]>
          </v:textbox>
        </v:rect>
        <![endif]-->
      </a>
    </div>
  `
}

function getVideoThumbnail(url: string): string {
  // YouTube
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
  if (youtubeMatch) {
    return `https://img.youtube.com/vi/${youtubeMatch[1]}/maxresdefault.jpg`
  }

  // Vimeo - would need API call, return placeholder
  return 'https://via.placeholder.com/600x340/0f172a/ffffff?text=Video'
}

function renderSocialBlock(content: SocialBlockContent): string {
  // Outgoing emails use externally-hosted icon images, NOT inline SVG.
  //
  // Why: Gmail web silently strips <svg> tags during sanitization, which
  // produced empty links + bare URL text in the rendered email. Apple
  // Mail renders inline SVG fine, but cross-client compatibility means
  // we have to assume the worst client.
  //
  // simpleicons.org/cdn.simpleicons.org hosts every brand mark we use,
  // CC0-licensed, with a query-string colour parameter. We pass the
  // pill's brand colour as the icon fill so the icon "floats" on a
  // white pill — Gmail also strips background-color from <a>, so a
  // white pill with a coloured icon is the most reliable look.
  const enabled = SOCIAL_PLATFORMS.filter(
    (p) => content.platforms[p.key]?.enabled,
  )
  if (enabled.length === 0) return ''

  const iconElements = enabled
    .map((p) => {
      const url = content.platforms[p.key]?.url || '#'
      // For coloured style: brand-coloured icon on a white pill.
      // For monochrome: grey icon on white pill.
      const iconColor = (content.style === 'coloured' ? p.brandColor : '#6b7280').replace('#', '')
      // Use cdnSlug when set (e.g. 'twitter' → 'x' since the rebrand);
      // otherwise the key is the simpleicons slug directly.
      const slug = p.cdnSlug ?? p.key
      const iconUrl = `https://cdn.simpleicons.org/${slug}/${iconColor}`
      return `
        <a href="${url}" target="_blank" style="display: inline-block; margin: 0 6px; text-decoration: none; line-height: 0;">
          <img src="${iconUrl}" width="24" height="24" alt="${p.label}" style="border: 0; display: inline-block; vertical-align: middle;" />
        </a>
      `
    })
    .join('')

  return `
    <div class="ifg-social" style="text-align: ${content.alignment}; padding: 15px 0;">
      ${iconElements}
    </div>
  `
}

function renderHTMLBlock(content: HTMLBlockContent): string {
  return content.code || ''
}

function renderColumnsBlock(content: ColumnsBlockContent, t: Required<TemplateTheme>): string {
  const gap = content.gap || 20
  const halfGap = Math.floor(gap / 2)
  const widths = content.columnWidths || (content.columns === 3 ? [33, 33, 34] : [50, 50])

  const renderColumnBlocks = (blocks: EditorBlock[]): string => {
    if (!blocks || blocks.length === 0) {
      return '<p style="margin: 0; color: #9ca3af; font-size: 14px;">Empty column</p>'
    }
    // Threading the theme matters most here: a paragraph inside a column
    // was rendering in the renderer's defaults, ignoring the brand entirely.
    return blocks.map((block) => renderBlock(block, t)).join('')
  }

  const leftTd = `<td style="width: ${widths[0]}%; vertical-align: top; padding-right: ${halfGap}px;">${renderColumnBlocks(content.leftBlocks)}</td>`

  let centerTd = ''
  if (content.columns === 3 && content.centerBlocks) {
    centerTd = `<td style="width: ${widths[1]}%; vertical-align: top; padding-left: ${halfGap}px; padding-right: ${halfGap}px;">${renderColumnBlocks(content.centerBlocks)}</td>`
  }

  const rightTd = `<td style="width: ${widths[content.columns === 3 ? 2 : 1]}%; vertical-align: top; padding-left: ${halfGap}px;">${renderColumnBlocks(content.rightBlocks)}</td>`

  return `
    <div style="padding-top: ${content.paddingTop || 0}px; padding-bottom: ${content.paddingBottom || 0}px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="table-layout: fixed;">
        <tr>
          ${leftTd}
          ${centerTd}
          ${rightTd}
        </tr>
      </table>
    </div>
  `
}

function renderConditionalBlock(content: ConditionalBlockContent, t: Required<TemplateTheme>): string {
  if (!content.children || content.children.length === 0) return ''

  const childrenHtml = content.children.map((block) => renderBlock(block, t)).join('')
  const field = content.conditionField
  const operator = content.conditionOperator
  const value = content.conditionValue

  return `
    <div style="padding-top: ${content.paddingTop || 0}px; padding-bottom: ${content.paddingBottom || 0}px;">
      {{#if ${field} ${operator} "${value}"}}${childrenHtml}{{/if}}
    </div>
  `
}

// Partner logos and the legal disclaimer are no longer rendered here.
// They moved into the global branding record (see render-branding.ts) so a
// single edit updates every template at once.

// Resolves an asset path for the company_signature and branding-header
// logos. Handles arbitrary paths under /public so the user can drop a
// new partner logo into public/signatures/ (or anywhere) and have it
// inlined automatically without code changes.
//
// Always returns an absolute https URL for relative paths. Earlier
// revisions tried to base64-inline the asset on the server (returning a
// `data:image/png;base64,...` URL), but Gmail web silently strips
// `data:` URIs from `<img src>` and the recipient sees broken images.
// An absolute https URL hosted on the Vercel deployment is the only
// option that renders consistently across Gmail, Apple Mail, Outlook
// 2019+, iOS Mail and Yahoo.
//
// Returns:
//   * unchanged if `src` is already absolute (https://… / data: / cid:)
//   * window.location.origin-prefixed URL when running in the browser
//     (canvas + preview iframe paths — same domain as the dev/prod app)
//   * NEXT_PUBLIC_APP_URL-prefixed URL otherwise (server-side renders)
export function resolveAssetUrl(src: string): string {
  if (!src) return ''
  if (/^(https?:|data:|cid:)/i.test(src)) return src

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${src.startsWith('/') ? src : '/' + src}`
  }

  return `${process.env.NEXT_PUBLIC_APP_URL || 'https://ifg-crm.vercel.app'}${src.startsWith('/') ? src : '/' + src}`
}

// Photo support intentionally removed — IFG signatures use the
// Macclesfield crest baked into SIGNATURE_COMPANY_BLOCK below the
// variable details, not a per-deal-owner headshot. The `showPhoto`
// and `photoSize` content fields are kept on the type for backward
// compatibility with templates already in the DB but they no longer
// render anything.
function renderRecruiterSignatureBlock(content: RecruiterSignatureBlockContent): string {
  // Variable-details colour applies ONLY to the name/title/email/phone
  // /Calendly rows. Company-info and confidentiality each have their
  // own override so the AI can target one region without dragging the
  // others along with it.
  const c = content.textColor

  // Sign-off line ("Kind Regards,") sits above the name. Default-on so
  // existing templates that pre-date this field render with the sign-off
  // automatically. To suppress, the recruiter sets `showSignOff: false`
  // in the editor settings panel.
  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const signOffHtml =
    content.showSignOff !== false
      ? `<p style="margin: 0 0 8px 0; font-size: 14px; color: ${c || '#374151'};">${escapeHtml(content.signOff || 'Kind Regards,')}</p>`
      : ''

  // Default fallback recruiter — Nathan Bibby. Mirrors the AC behaviour
  // where Nathan is the catch-all when a deal has no owner / unrecognised
  // owner. Falls back per-field via the `{{tag|fallback}}` syntax (handled
  // by lib/utils/merge-tags-core), so a deal with a real owner gets that
  // owner's data and only missing fields draw from these defaults.
  const FALLBACK_NAME = 'Nathan Bibby'
  const FALLBACK_TITLE = 'Director of Recruitment & Scouting'
  const FALLBACK_EMAIL = 'nathan@macclesfieldfc.com'
  const FALLBACK_PHONE = '+1 (714) 515-2767'

  const nameHtml = content.showName
    ? `<p style="margin: 0 0 2px 0; font-weight: bold; font-size: 16px; color: ${c || '#111827'};">{{deal_owner_name|${FALLBACK_NAME}}}</p>`
    : ''

  const titleHtml = content.showTitle
    ? `<p style="margin: 0 0 2px 0; font-size: 14px; color: ${c || '#6b7280'};">{{deal_owner_title|${FALLBACK_TITLE}}}</p>`
    : ''

  const emailHtml = content.showEmail
    ? `<p style="margin: 0 0 2px 0; font-size: 14px;"><a href="mailto:{{deal_owner_email|${FALLBACK_EMAIL}}}" style="color: ${c || '#3b82f6'}; text-decoration: none;">{{deal_owner_email|${FALLBACK_EMAIL}}}</a></p>`
    : ''

  const phoneHtml = content.showPhone
    ? `<p style="margin: 0 0 2px 0; font-size: 14px; color: ${c || '#374151'};">{{deal_owner_phone|${FALLBACK_PHONE}}}</p>`
    : ''

  // Calendly stays gated on {{#if}} — Nathan doesn't have a public
  // Calendly link configured, so we'd rather hide the row than render a
  // broken/blank "Book a meeting" link.
  const calendlyHtml = content.showCalendly
    ? `{{#if deal_owner_calendly}}<p style="margin: 4px 0 0 0;"><a href="{{deal_owner_calendly}}" target="_blank" style="color: ${c || '#3b82f6'}; text-decoration: none; font-size: 14px;">Book a meeting</a></p>{{/if}}`
    : ''

  const detailsHtml = `${signOffHtml}${nameHtml}${titleHtml}${emailHtml}${phoneHtml}${calendlyHtml}`

  // Sender details only — partner logos + legal disclaimer moved out
  // into the dedicated company_signature block below. Templates that
  // need both should drop the company_signature block in after this
  // one (usually with a Spacer or Divider in between).
  return `
    <div style="text-align: ${content.alignment}; padding-top: ${content.paddingTop}px; padding-bottom: ${content.paddingBottom}px;">
      ${detailsHtml}
    </div>
  `
}

// Static company / brand block — partner logos in a row + the legal
// confidentiality paragraph. Same content the AC footer carries; mirror
// of CompanySignatureBlock.tsx so the editor preview matches what
// recipients get.
function renderCompanySignatureBlock(content: CompanySignatureBlockContent): string {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const disclaimerHtml = (content.disclaimer || '')
    .split('\n')
    .map((line) => escape(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'))
    .join('<br/>')

  const logos = (content.logos || []).filter((l) => l.src)
  const logoWidth = content.logoWidth ?? 120
  // Resolve each logo src — relative paths (/signatures/...) get
  // base64-inlined on the server side so the recipient's email client
  // can render them without fetching from the IFG domain.
  const logosHtml =
    logos.length > 0
      ? `<div style="text-align: ${content.alignment || 'center'}; margin-bottom: 16px;">${logos
          .map(
            (l) =>
              `<img class="ifg-co-logo" src="${escape(resolveAssetUrl(l.src))}" alt="${escape(l.alt || '')}" style="display: inline-block; width: ${logoWidth}px; max-width: 100%; height: auto; margin: 0 16px; vertical-align: middle;" />`,
          )
          .join('')}</div>`
      : ''

  const colour = content.textColor || '#475569'

  return `
    <div style="text-align: ${content.alignment || 'center'}; padding-top: ${content.paddingTop ?? 24}px; padding-bottom: ${content.paddingBottom ?? 16}px;">
      ${logosHtml}
      <p style="margin: 0; font-size: 12px; line-height: 1.6; color: ${colour}; font-style: italic;">
        ${disclaimerHtml}
      </p>
    </div>
  `
}

function renderFileBlock(content: FileBlockContent): string {
  if (!content.fileUrl) return ''

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formattedSize = formatFileSize(content.fileSize || 0)

  return `
    <div style="text-align: ${content.alignment || 'left'}; padding-top: ${content.paddingTop || 10}px; padding-bottom: ${content.paddingBottom || 10}px;">
      <a href="${content.fileUrl}" target="_blank" style="display: inline-block; padding: 12px 16px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; text-decoration: none; color: #374151; font-family: Arial, Helvetica, sans-serif;">
        &#128206; <strong>${content.fileName || 'Attachment'}</strong>
        <span style="color: #9ca3af; font-size: 12px; margin-left: 4px;">(${formattedSize})</span>
      </a>
    </div>
  `
}

export function replaceVariables(
  html: string,
  data: {
    first_name?: string
    last_name?: string
    email?: string
    programme?: string
    calendly_link?: string
    recruiter_name?: string
    recruiter_email?: string
    unsubscribe_url?: string
    subject?: string
  }
): string {
  return html
    .replace(/\{\{first_name\}\}/g, data.first_name || '')
    .replace(/\{\{last_name\}\}/g, data.last_name || '')
    .replace(/\{\{email\}\}/g, data.email || '')
    .replace(/\{\{programme\}\}/g, data.programme || '')
    .replace(/\{\{calendly_link\}\}/g, data.calendly_link || '#')
    .replace(/\{\{recruiter_name\}\}/g, data.recruiter_name || '')
    .replace(/\{\{recruiter_email\}\}/g, data.recruiter_email || '')
    .replace(/\{\{unsubscribe_url\}\}/g, data.unsubscribe_url || '#')
    .replace(/\{\{subject\}\}/g, data.subject || '')
}
