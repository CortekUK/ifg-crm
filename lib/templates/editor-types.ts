export type BlockType = 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'video' | 'social' | 'html'

export interface EditorBlock {
  id: string
  type: BlockType
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: Record<string, any>
}

export type BlockContent = 
  | TextBlockContent
  | ImageBlockContent
  | ButtonBlockContent
  | DividerBlockContent
  | SpacerBlockContent
  | VideoBlockContent
  | SocialBlockContent
  | HTMLBlockContent

export interface TextBlockContent {
  html: string
  alignment: 'left' | 'center' | 'right'
  fontSize: 'small' | 'normal' | 'large'
  paddingTop: number
  paddingBottom: number
  backgroundColor?: string
}

export interface ImageBlockContent {
  src: string
  alt: string
  linkUrl?: string
  alignment: 'left' | 'center' | 'right'
  width: number | 'full'
}

export interface ButtonBlockContent {
  text: string
  url: string
  backgroundColor: string
  textColor: string
  borderRadius: number
  width: 'auto' | 'full'
  alignment: 'left' | 'center' | 'right'
  paddingTop: number
  paddingBottom: number
}

export interface DividerBlockContent {
  style: 'solid' | 'dashed' | 'dotted'
  color: string
  thickness: number
  paddingTop: number
  paddingBottom: number
}

export interface SpacerBlockContent {
  height: number
}

export interface VideoBlockContent {
  url: string
  thumbnailUrl?: string
  width: number | 'full'
  alignment: 'left' | 'center' | 'right'
}

export interface SocialBlockContent {
  platforms: {
    facebook: { enabled: boolean; url: string }
    twitter: { enabled: boolean; url: string }
    instagram: { enabled: boolean; url: string }
    linkedin: { enabled: boolean; url: string }
    youtube: { enabled: boolean; url: string }
  }
  style: 'coloured' | 'monochrome'
  alignment: 'left' | 'center' | 'right'
}

export interface HTMLBlockContent {
  code: string
}

export interface TemplateSettings {
  name: string
  subject: string
  preheader: string
  fromNameType: 'deal_owner' | 'fixed'
  fixedFromName: string
  fixedFromEmail: string
  category: 'automation' | 'campaign' | 'transactional'
}

export interface EmailTemplateData {
  id?: string
  name: string
  subject: string
  preheader: string
  fromNameType: 'deal_owner' | 'fixed'
  fixedFromName?: string
  fixedFromEmail?: string
  category: 'automation' | 'campaign' | 'transactional'
  blocks: EditorBlock[]
}

export interface EditorState {
  blocks: EditorBlock[]
  settings: TemplateSettings
}

export const defaultTemplateSettings: TemplateSettings = {
  name: 'Untitled Template',
  subject: '',
  preheader: '',
  fromNameType: 'deal_owner',
  fixedFromName: '',
  fixedFromEmail: '',
  category: 'campaign',
}

export const defaultBlockContent: Record<BlockType, BlockContent> = {
  text: {
    html: '<p>Enter your text here...</p>',
    alignment: 'left',
    fontSize: 'normal',
    paddingTop: 10,
    paddingBottom: 10,
  } as TextBlockContent,
  image: {
    src: '',
    alt: '',
    alignment: 'center',
    width: 'full',
  } as ImageBlockContent,
  button: {
    text: 'Click Here',
    url: '',
    backgroundColor: '#3b82f6',
    textColor: '#ffffff',
    borderRadius: 6,
    width: 'auto',
    alignment: 'center',
    paddingTop: 10,
    paddingBottom: 10,
  } as ButtonBlockContent,
  divider: {
    style: 'solid',
    color: '#e5e7eb',
    thickness: 1,
    paddingTop: 10,
    paddingBottom: 10,
  } as DividerBlockContent,
  spacer: {
    height: 20,
  } as SpacerBlockContent,
  video: {
    url: '',
    alignment: 'center',
    width: 'full',
  } as VideoBlockContent,
  social: {
    platforms: {
      facebook: { enabled: true, url: '' },
      twitter: { enabled: true, url: '' },
      instagram: { enabled: true, url: '' },
      linkedin: { enabled: false, url: '' },
      youtube: { enabled: false, url: '' },
    },
    style: 'coloured',
    alignment: 'center',
  } as SocialBlockContent,
  html: {
    code: '<!-- Custom HTML here -->',
  } as HTMLBlockContent,
}

export const templateVariables = [
  { label: 'First Name', value: '{{first_name}}', description: "Contact's first name" },
  { label: 'Last Name', value: '{{last_name}}', description: "Contact's last name" },
  { label: 'Email', value: '{{email}}', description: "Contact's email" },
  { label: 'Programme', value: '{{programme}}', description: 'Programme name' },
  { label: 'Calendly Link', value: '{{calendly_link}}', description: "Recruiter's Calendly URL" },
  { label: 'Recruiter Name', value: '{{recruiter_name}}', description: "Recruiter's name" },
  { label: 'Recruiter Email', value: '{{recruiter_email}}', description: "Recruiter's email" },
]

export const sampleContacts = [
  { id: '1', first_name: 'John', last_name: 'Smith', email: 'john.smith@example.com' },
  { id: '2', first_name: 'Emma', last_name: 'Wilson', email: 'emma.wilson@example.com' },
  { id: '3', first_name: 'James', last_name: 'Brown', email: 'james.brown@example.com' },
]
