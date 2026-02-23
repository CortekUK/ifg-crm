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
  FileBlockContent,
} from './editor-types'

export function renderBlocksToHTML(blocks: EditorBlock[]): string {
  const header = `
    <div style="background-color: #0f172a; padding: 20px; text-align: center;">
      <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
        <tr>
          <td style="vertical-align: middle;">
            <span style="color: white; font-size: 24px; font-weight: bold;">IFG</span>
          </td>
          <td style="vertical-align: middle; padding-left: 10px;">
            <span style="color: white; font-size: 16px;">International Football Group</span>
          </td>
        </tr>
      </table>
    </div>
  `

  const body = blocks.map((block) => renderBlock(block)).join('')

  const footer = `
    <div style="background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280;">
      <p style="margin: 0 0 10px 0;">International Football Group</p>
      <p style="margin: 0 0 10px 0;">Macclesfield FC, United Kingdom</p>
      <p style="margin: 0;"><a href="{{unsubscribe_url}}" style="color: #3b82f6;">Unsubscribe</a></p>
    </div>
  `

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
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f9fafb;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f9fafb;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff;">
          <tr>
            <td>
              ${header}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td>
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

function renderBlock(block: EditorBlock): string {
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
  const img = `<img src="${content.src}" alt="${content.alt}" style="${widthStyle} height: auto; display: block;" />`

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
  const icons: { platform: keyof typeof content.platforms; label: string; color: string }[] = [
    { platform: 'facebook', label: 'Facebook', color: '#1877f2' },
    { platform: 'twitter', label: 'Twitter', color: '#1da1f2' },
    { platform: 'instagram', label: 'Instagram', color: '#e4405f' },
    { platform: 'linkedin', label: 'LinkedIn', color: '#0a66c2' },
    { platform: 'youtube', label: 'YouTube', color: '#ff0000' },
  ]

  const enabledIcons = icons.filter((icon) => content.platforms[icon.platform].enabled)

  if (enabledIcons.length === 0) return ''

  const iconElements = enabledIcons
    .map((icon) => {
      const url = content.platforms[icon.platform].url || '#'
      const bgColor = content.style === 'coloured' ? icon.color : '#6b7280'
      return `
        <a href="${url}" target="_blank" style="display: inline-block; width: 36px; height: 36px; background-color: ${bgColor}; border-radius: 50%; margin: 0 5px; text-align: center; line-height: 36px; color: white; text-decoration: none; font-size: 14px;">
          ${icon.label.charAt(0)}
        </a>
      `
    })
    .join('')

  return `
    <div style="text-align: ${content.alignment}; padding: 15px 0;">
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

function renderRecruiterSignatureBlock(content: RecruiterSignatureBlockContent): string {
  const photoSizeMap = { small: 40, medium: 60, large: 80 }
  const photoSize = photoSizeMap[content.photoSize] || 60

  const nameHtml = content.showName
    ? `{{#if deal_owner_name}}<p style="margin: 0 0 2px 0; font-weight: bold; font-size: 16px; color: #111827;">{{deal_owner_name}}</p>{{/if}}`
    : ''

  const titleHtml = content.showTitle
    ? `{{#if deal_owner_title}}<p style="margin: 0 0 2px 0; font-size: 14px; color: #6b7280;">{{deal_owner_title}}</p>{{/if}}`
    : ''

  const emailHtml = content.showEmail
    ? `{{#if deal_owner_email}}<p style="margin: 0 0 2px 0; font-size: 14px;"><a href="mailto:{{deal_owner_email}}" style="color: #3b82f6; text-decoration: none;">{{deal_owner_email}}</a></p>{{/if}}`
    : ''

  const phoneHtml = content.showPhone
    ? `{{#if deal_owner_phone}}<p style="margin: 0 0 2px 0; font-size: 14px; color: #374151;">{{deal_owner_phone}}</p>{{/if}}`
    : ''

  const calendlyHtml = content.showCalendly
    ? `{{#if deal_owner_calendly}}<p style="margin: 4px 0 0 0;"><a href="{{deal_owner_calendly}}" target="_blank" style="color: #3b82f6; text-decoration: none; font-size: 14px;">Book a meeting</a></p>{{/if}}`
    : ''

  const detailsHtml = `${nameHtml}${titleHtml}${emailHtml}${phoneHtml}${calendlyHtml}`

  if (content.layout === 'inline' && content.showPhoto) {
    const photoHtml = `{{#if deal_owner_photo}}<img src="{{deal_owner_photo}}" alt="{{deal_owner_name}}" style="width: ${photoSize}px; height: ${photoSize}px; border-radius: 50%; display: block;" />{{/if}}`

    return `
      <div style="text-align: ${content.alignment}; padding-top: ${content.paddingTop}px; padding-bottom: ${content.paddingBottom}px;">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align: top; padding-right: 12px;">
              ${photoHtml}
            </td>
            <td style="vertical-align: top;">
              ${detailsHtml}
            </td>
          </tr>
        </table>
      </div>
    `
  }

  // Stacked layout (or inline without photo)
  const photoHtml = content.showPhoto
    ? `{{#if deal_owner_photo}}<img src="{{deal_owner_photo}}" alt="{{deal_owner_name}}" style="width: ${photoSize}px; height: ${photoSize}px; border-radius: 50%; display: block; margin-bottom: 8px;${content.alignment === 'center' ? ' margin-left: auto; margin-right: auto;' : ''}" />{{/if}}`
    : ''

  return `
    <div style="text-align: ${content.alignment}; padding-top: ${content.paddingTop}px; padding-bottom: ${content.paddingBottom}px;">
      ${photoHtml}
      ${detailsHtml}
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
