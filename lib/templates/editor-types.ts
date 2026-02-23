export type BlockType = 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'video' | 'social' | 'html' | 'columns' | 'conditional' | 'recruiter_signature' | 'file'

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
  | ColumnsBlockContent
  | ConditionalBlockContent
  | RecruiterSignatureBlockContent
  | FileBlockContent

export interface TextBlockContent {
  html: string
  alignment: 'left' | 'center' | 'right'
  fontSize: 'small' | 'normal' | 'large' | 'xlarge'
  paddingTop: number
  paddingBottom: number
  backgroundColor?: string
}

export interface ImageBlockContent {
  src: string
  alt: string
  linkUrl?: string
  alignment: 'left' | 'center' | 'right'
  width: string // '100', '75', '50', '25', 'auto'
  paddingTop: number
  paddingBottom: number
}

export interface ButtonBlockContent {
  text: string
  url: string
  backgroundColor: string
  textColor: string
  borderRadius: number
  width: 'auto' | 'full' | '50' | '75'
  alignment: 'left' | 'center' | 'right'
  paddingTop: number
  paddingBottom: number
  paddingX?: number
  paddingY?: number
}

export interface DividerBlockContent {
  style: 'solid' | 'dashed' | 'dotted'
  color: string
  thickness: number
  width: string // '100', '75', '50', '25'
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

export interface ColumnsBlockContent {
  columns: 2 | 3
  columnWidths: number[] // percentages, e.g., [50, 50] or [33, 33, 34]
  gap: number // px
  leftBlocks: EditorBlock[]
  rightBlocks: EditorBlock[]
  centerBlocks?: EditorBlock[] // only for 3-column
  paddingTop: number
  paddingBottom: number
}

export interface ConditionalBlockContent {
  conditionField: 'deal_owner_email' | 'deal_owner_name' | 'deal_pipeline'
  conditionOperator: 'equals' | 'not_equals' | 'contains'
  conditionValue: string
  children: EditorBlock[]
  paddingTop: number
  paddingBottom: number
}

export interface RecruiterSignatureBlockContent {
  showPhoto: boolean
  showName: boolean
  showTitle: boolean
  showEmail: boolean
  showPhone: boolean
  showCalendly: boolean
  layout: 'stacked' | 'inline' // stacked = vertical, inline = photo left + details right
  alignment: 'left' | 'center' | 'right'
  photoSize: 'small' | 'medium' | 'large' // 40px, 60px, 80px
  paddingTop: number
  paddingBottom: number
}

export interface FileBlockContent {
  fileName: string
  fileUrl: string
  fileSize: number
  fileType: string
  alignment: 'left' | 'center' | 'right'
  paddingTop: number
  paddingBottom: number
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
    width: '100',
    paddingTop: 10,
    paddingBottom: 10,
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
    paddingX: 24,
    paddingY: 12,
  } as ButtonBlockContent,
  divider: {
    style: 'solid',
    color: '#e5e7eb',
    thickness: 1,
    width: '100',
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
  columns: {
    columns: 2,
    columnWidths: [50, 50],
    gap: 20,
    leftBlocks: [],
    rightBlocks: [],
    paddingTop: 10,
    paddingBottom: 10,
  } as ColumnsBlockContent,
  conditional: {
    conditionField: 'deal_owner_email',
    conditionOperator: 'equals',
    conditionValue: '',
    children: [],
    paddingTop: 0,
    paddingBottom: 0,
  } as ConditionalBlockContent,
  recruiter_signature: {
    showPhoto: true,
    showName: true,
    showTitle: true,
    showEmail: true,
    showPhone: true,
    showCalendly: true,
    layout: 'inline',
    alignment: 'left',
    photoSize: 'medium',
    paddingTop: 20,
    paddingBottom: 10,
  } as RecruiterSignatureBlockContent,
  file: {
    fileName: '',
    fileUrl: '',
    fileSize: 0,
    fileType: '',
    alignment: 'left',
    paddingTop: 10,
    paddingBottom: 10,
  } as FileBlockContent,
}

export const templateVariables = [
  // Contact fields
  { label: 'First Name', value: '{{first_name}}', description: "Contact's first name", category: 'contact' },
  { label: 'Last Name', value: '{{last_name}}', description: "Contact's last name", category: 'contact' },
  { label: 'Email', value: '{{email}}', description: "Contact's email", category: 'contact' },
  { label: 'Phone', value: '{{phone}}', description: "Contact's phone number", category: 'contact' },
  
  // Deal fields
  { label: 'Deal Title', value: '{{deal_title}}', description: 'Title of the deal', category: 'deal' },
  { label: 'Deal Value', value: '{{deal_value}}', description: 'Monetary value of the deal', category: 'deal' },
  { label: 'Deal Stage', value: '{{deal_stage}}', description: 'Current stage of the deal', category: 'deal' },
  { label: 'Deal Pipeline', value: '{{deal_pipeline}}', description: 'Pipeline the deal belongs to', category: 'deal' },
  { label: 'Programme Name', value: '{{programme_name}}', description: 'Name of the programme', category: 'deal' },
  
  // Deal owner fields
  { label: 'Owner Name', value: '{{deal_owner_name}}', description: 'Full name of the deal owner', category: 'owner' },
  { label: 'Owner Title', value: '{{deal_owner_title}}', description: 'Job title of the deal owner', category: 'owner' },
  { label: 'Owner Email', value: '{{deal_owner_email}}', description: 'Email address of the deal owner', category: 'owner' },
  { label: 'Owner Phone', value: '{{deal_owner_phone}}', description: 'Phone number of the deal owner', category: 'owner' },
  { label: 'Owner Photo', value: '{{deal_owner_photo}}', description: 'Profile photo URL of the deal owner', category: 'owner' },
  { label: 'Calendly Link', value: '{{deal_owner_calendly}}', description: 'Calendly scheduling link', category: 'owner' },
  { label: 'Email Signature', value: '{{deal_owner_signature}}', description: 'Email signature of the deal owner', category: 'owner' },
]

// Category labels for grouping in UI
export const templateVariableCategories = {
  contact: 'Contact',
  deal: 'Deal',
  owner: 'Deal Owner',
} as const

export const sampleContacts = [
  { id: '1', first_name: 'John', last_name: 'Smith', email: 'john.smith@example.com' },
  { id: '2', first_name: 'Emma', last_name: 'Wilson', email: 'emma.wilson@example.com' },
  { id: '3', first_name: 'James', last_name: 'Brown', email: 'james.brown@example.com' },
]
