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
    default:
      return ''
  }
}

function renderTextBlock(content: TextBlockContent): string {
  const fontSize = content.fontSize === 'small' ? '14px' : content.fontSize === 'large' ? '18px' : '16px'
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

  const widthStyle = content.width === 'full' ? 'width: 100%;' : `width: ${content.width}px; max-width: 100%;`
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
      <a href="${content.url}" target="_blank" style="${widthStyle} background-color: ${content.backgroundColor}; color: ${content.textColor}; padding: 12px 24px; text-decoration: none; border-radius: ${content.borderRadius}px; font-weight: bold; font-size: 16px;">
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
  const widthStyle = content.width === 'full' ? 'width: 100%;' : `width: ${content.width}px; max-width: 100%;`

  return `
    <div style="text-align: ${content.alignment}; padding: 10px 0;">
      <a href="${content.url}" target="_blank" style="display: inline-block; position: relative;">
        <img src="${thumbnailUrl}" alt="Video thumbnail" style="${widthStyle} height: auto; display: block;" />
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 60px; height: 60px; background-color: rgba(0,0,0,0.7); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
          <span style="color: white; font-size: 24px; margin-left: 4px;">▶</span>
        </div>
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
