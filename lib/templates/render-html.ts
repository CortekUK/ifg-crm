import type {
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
  TemplateTheme,
} from './editor-types'
// socialIconSvg used to be imported here for inline-SVG embedding, but
// renderSocialBlock now uses externally-hosted icons via simpleicons.org
// (Gmail strips inline SVG). The registry of platforms is still the
// single source of truth for which keys are renderable.
import { SOCIAL_PLATFORMS } from './social-icons'

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
): string {
  const t = resolveTheme(theme)
  const s: BrandingSlots = slots ?? BRANDING_MARKERS

  const body = blocks.map((block) => renderBlock(block)).join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>{{subject}}</title>
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
      .ifg-header-logo {
        max-width: 40% !important;
        margin: 0 6px !important;
      }
      .ifg-social a { margin: 0 3px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: ${t.pageBgColor};">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${t.pageBgColor};">
    <tr>
      <td align="center">
        <!--[if mso]>
        <table cellpadding="0" cellspacing="0" border="0" width="600" align="center" style="background-color: ${t.bodyBgColor};">
          <tr><td>
        <![endif]-->
        <table class="ifg-shell" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: ${t.bodyBgColor};">
          <tr>
            <td>
              ${s.header}
            </td>
          </tr>
          <tr>
            <td class="ifg-content-cell" style="padding: 20px;">
              ${body}${s.footer}
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
export function renderBlock(block: EditorBlock): string {
  switch (block.type) {
    case 'text':
      return renderTextBlock(block.content as TextBlockContent)
    case 'image':
      return renderImageBlock(block.content as ImageBlockContent)
    case 'button':
      return renderButtonBlock(block.content as ButtonBlockContent)
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
      return renderColumnsBlock(block.content as ColumnsBlockContent)
    case 'conditional':
      return renderConditionalBlock(block.content as ConditionalBlockContent)
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

function renderTextBlock(content: TextBlockContent): string {
  const fontSize = content.fontSize === 'small' ? '14px'
    : content.fontSize === 'large' ? '18px'
    : content.fontSize === 'xlarge' ? '24px'
    : '16px'
  const bgStyle = content.backgroundColor ? `background-color: ${content.backgroundColor};` : ''

  return `
    <div style="text-align: ${content.alignment}; padding-top: ${content.paddingTop}px; padding-bottom: ${content.paddingBottom}px; font-size: ${fontSize}; line-height: 1.6; ${bgStyle}">
      ${content.html}
    </div>
  `
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
  const img = `<img src="${resolveAssetUrl(content.src)}" alt="${content.alt}" style="${widthStyle} height: auto; display: block;" />`

  const imageContent = content.linkUrl ? `<a href="${content.linkUrl}" target="_blank">${img}</a>` : img

  return `
    <div style="text-align: ${content.alignment}; padding: 10px 0;">
      ${imageContent}
    </div>
  `
}

function renderButtonBlock(content: ButtonBlockContent): string {
  const widthStyle = content.width === 'full' ? 'display: block; width: 100%; text-align: center;' : 'display: inline-block;'

  return `
    <div style="text-align: ${content.alignment}; padding-top: ${content.paddingTop}px; padding-bottom: ${content.paddingBottom}px;">
      <a href="${content.url}" target="_blank" style="${widthStyle} background-color: ${content.backgroundColor}; color: ${content.textColor}; padding: ${content.paddingY || 12}px ${content.paddingX || 24}px; text-decoration: none; border-radius: ${content.borderRadius}px; font-weight: bold; font-size: 16px;">
        ${content.text}
      </a>
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

function renderColumnsBlock(content: ColumnsBlockContent): string {
  const gap = content.gap || 20
  const halfGap = Math.floor(gap / 2)
  const widths = content.columnWidths || (content.columns === 3 ? [33, 33, 34] : [50, 50])

  const renderColumnBlocks = (blocks: EditorBlock[]): string => {
    if (!blocks || blocks.length === 0) {
      return '<p style="margin: 0; color: #9ca3af; font-size: 14px;">Empty column</p>'
    }
    return blocks.map((block) => renderBlock(block)).join('')
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

function renderConditionalBlock(content: ConditionalBlockContent): string {
  if (!content.children || content.children.length === 0) return ''

  const childrenHtml = content.children.map((block) => renderBlock(block)).join('')
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
