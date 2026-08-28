export type BlockType = 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'video' | 'social' | 'html' | 'columns' | 'conditional' | 'recruiter_signature' | 'company_signature' | 'file' | 'hero' | 'cards' | 'quote' | 'section'

export interface EditorBlock {
  id: string
  type: BlockType
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: Record<string, any>
}

export type BlockContent =
  | SectionBlockContent
  | HeroBlockContent
  | CardsBlockContent
  | QuoteBlockContent
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
  | CompanySignatureBlockContent
  | FileBlockContent

export interface TextBlockContent {
  html: string
  alignment: 'left' | 'center' | 'right'
  fontSize: 'small' | 'normal' | 'large' | 'xlarge'
  paddingTop: number
  paddingBottom: number
  backgroundColor?: string
}

/**
 * A full-width band: its own background, its own text colour, its own blocks
 * inside it.
 *
 * This is the piece the designed references are built from and the piece we
 * were missing. Everything used to sit in one padded white cell, so every
 * template came out as the same white card with the same margins — which is
 * exactly the "they all look similar" the client saw. A section escapes that
 * cell: edge to edge, dark on dark, image behind it.
 *
 * `textColor` and `mutedColor` override the theme for the blocks INSIDE the
 * band, because a dark band needs light type and the children shouldn't each
 * have to be re-coloured by hand.
 */
export interface SectionBlockContent {
  backgroundColor: string
  backgroundImageUrl: string
  /** 0–100. Darkens the background image behind the content. */
  overlayOpacity: number
  /** Body and heading colour for everything inside. Blank keeps the theme's. */
  textColor: string
  /** Small-print colour inside. Blank keeps the theme's. */
  mutedColor: string
  paddingY: number
  paddingX: number
  children: EditorBlock[]
}

/**
 * A photograph with a headline and call to action over it.
 *
 * Text over an image is the one layout email clients disagree about most:
 * Outlook's Word engine cannot position anything over a CSS background, so the
 * renderer emits VML for it. `overlayOpacity` darkens the photo so light
 * imagery can't swallow white type — Outlook can't composite that either,
 * which is why the editor asks for a dark image.
 */
export interface HeroBlockContent {
  imageUrl: string
  /** Small uppercase line above the headline — the reference designs all
   *  open with one, and it does more for the tone than any other element. */
  eyebrow?: string
  heading: string
  subheading: string
  buttonText: string
  buttonUrl: string
  /** 0–100. How much the photo is darkened behind the text. */
  overlayOpacity: number
  textColor: string
  alignment: 'left' | 'center'
  height: 'short' | 'medium' | 'tall'
  /** 'display' is poster size; 'giant' is a wordmark used as a graphic. */
  size?: 'regular' | 'display' | 'giant'
  /** Span the full width of the email, ignoring the content padding. */
  fullBleed?: boolean
  /** Panel colour when there is no photograph. Blank uses the ink colour. */
  backgroundColor?: string
}

/** One panel in a cards row. */
export interface CardItem {
  title: string
  body: string
  /** Optional emoji or short glyph shown above the title. */
  icon: string
}

/**
 * Two or three side-by-side panels — the "what you get / what you won't"
 * layout. Renders as a table so it survives Outlook, and stacks on narrow
 * screens through the shell's media query.
 */
export interface CardsBlockContent {
  items: CardItem[]
  columns: 2 | 3
  backgroundColor: string
  borderColor: string
  paddingTop: number
  paddingBottom: number
}

/** A pull quote or a headline statistic. */
export interface QuoteBlockContent {
  text: string
  attribution: string
  /** 'quote' sets the text in italics; 'stat' sets it large and bold. */
  variant: 'quote' | 'stat'
  backgroundColor: string
  /** Blank uses the theme's brand colour. */
  accentColor: string
  paddingTop: number
  paddingBottom: number
}

export interface ImageBlockContent {
  src: string
  alt: string
  /** Edge to edge, with no padding either side. */
  fullBleed?: boolean
  /** Rounded corners, in px. Ignored by Outlook like every other radius. */
  radius?: number
  linkUrl?: string
  alignment: 'left' | 'center' | 'right'
  width: string // '100', '75', '50', '25', 'auto'
  paddingTop: number
  paddingBottom: number
}

export interface ButtonBlockContent {
  text: string
  url: string
  /** 'outline' is the hollow pill the reference designs use — a border in the
   *  brand colour with the label to match, and no fill. */
  variant?: 'solid' | 'outline'
  /**
   * Opt out of the theme's brand colour and corners for this one button.
   * Off by default so a brand change restyles every call to action at once.
   */
  customColour?: boolean
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
    tiktok: { enabled: boolean; url: string }
    threads: { enabled: boolean; url: string }
    flickr: { enabled: boolean; url: string }
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
  // Optional sign-off line above the name — defaults to "Kind Regards,"
  // Toggle off via showSignOff:false; override the wording via signOff.
  // Stored separately from the name so it inherits the same colour /
  // alignment overrides as the rest of the variable details, AND so a
  // recruiter can switch to "Best wishes," / "Cheers," for one template
  // without dropping the block and rebuilding it.
  showSignOff?: boolean
  signOff?: string
  showName: boolean
  showTitle: boolean
  showEmail: boolean
  showPhone: boolean
  showCalendly: boolean
  layout: 'stacked' | 'inline' // stacked = vertical, inline = photo left + details right
  alignment: 'left' | 'center' | 'right'
  photoSize: 'small' | 'medium' | 'large' // 40px, 60px, 80px
  // The signature has THREE text regions that can each be coloured
  // independently — split out so the AI / user can recolour one
  // region (e.g. just the confidentiality disclaimer) without
  // dragging the others along:
  //   textColor         — variable details (name, title, email, phone, Calendly)
  //   companyTextColor  — "Macc Football Club Limited…" registered-office line
  //   confidentialityColor — the Confidentiality disclaimer paragraph
  // All optional; when null/undefined the tasteful defaults render.
  textColor?: string | null
  companyTextColor?: string | null
  confidentialityColor?: string | null
  paddingTop: number
  paddingBottom: number
}

// Static company / brand block: a row of partner logos (UCLan, IFG,
// Macclesfield FC by default) plus the legal-confidentiality paragraph
// that lives at the bottom of every IFG email.
//
// Split out from recruiter_signature on purpose — the per-deal-owner
// info (name / title / phone / email) lives in the Sender Details
// (recruiter_signature) block, while this block holds the bits that
// don't change between recruiters. Keeps both blocks composable so a
// template can have one, the other, both, or neither.
export interface CompanySignatureBlockContent {
  // Each logo is independently editable so the user can swap a partner
  // (e.g. switch UCLan for another university per programme) without
  // editing the whole block. Empty `src` hides that slot.
  logos: { src: string; alt: string; href?: string }[]
  // Width of every logo in pixels. Logos are centred horizontally as a
  // row; gap is fixed via the renderer for a consistent look.
  logoWidth: number
  // The legal/confidentiality paragraph. Stored as raw markdown-ish
  // string with simple "**bold**" handling — no rich editor here, the
  // copy is pretty stable and per-template overrides are rare.
  disclaimer: string
  // Optional colour overrides — null/undefined → tasteful defaults.
  textColor?: string | null
  alignment: 'left' | 'center' | 'right'
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

// Per-template theme controlling the parts of the email that live
// OUTSIDE the block tree (the IFG header strip, the footer strip,
// page bg, body bg). All fields are optional — when undefined we
// render the IFG defaults (`#0f172a` header, `#f3f4f6` footer, etc.),
// so existing templates keep their current look without a migration.
//
// Exposed to the AI through the JSON-schema response so prompts like
// "change the header colour to red" or "make the page bg cream" can
// be honoured without dropping a custom html block on top.
/**
 * Named font stacks. Every one ends in a websafe face, because a custom font
 * is a suggestion in email — Outlook and most mobile clients ignore webfonts
 * entirely, so the fallback is what a large share of readers actually see.
 * The pairing has to look deliberate in the fallback too.
 */
export type ThemeFont = 'system' | 'modern' | 'classic' | 'editorial' | 'condensed' | 'mono'

/** Corner treatment for buttons and panels. Outlook squares these off. */
export type ThemeCorners = 'square' | 'soft' | 'pill'

/** Vertical rhythm — how much air the content is given. */
export type ThemeRhythm = 'compact' | 'comfortable' | 'airy'

export interface TemplateTheme {
  headerBgColor?: string
  headerTextColor?: string
  footerBgColor?: string
  footerTextColor?: string
  footerLinkColor?: string
  // Page background = the area around the email card. `bodyBgColor`
  // is the card itself (white by default).
  pageBgColor?: string
  bodyBgColor?: string

  // ── Brand ────────────────────────────────────────────────────────────────
  /** Buttons, links and accents. The one colour that carries the brand. */
  primaryColor?: string
  /** Body copy and headings. */
  inkColor?: string
  /** Muted text — captions, secondary lines. */
  mutedColor?: string

  // ── Typography ───────────────────────────────────────────────────────────
  headingFont?: ThemeFont
  bodyFont?: ThemeFont
  /** Base body size in px. Headings scale from this. */
  baseFontSize?: number
  /** Multiplier on the heading scale, so one control makes type bigger. */
  headingScale?: number

  // ── Shape & rhythm ───────────────────────────────────────────────────────
  corners?: ThemeCorners
  rhythm?: ThemeRhythm
}

export interface TemplateSettings {
  /**
   * False when the template supplies its own header and footer as blocks.
   * Such a template must carry its own unsubscribe link — the global legal
   * strip is switched off with everything else.
   */
  useGlobalBranding?: boolean
  name: string
  subject: string
  preheader: string
  fromNameType: 'deal_owner' | 'fixed'
  fixedFromName: string
  fixedFromEmail: string
  category: 'automation' | 'campaign' | 'transactional'
  theme?: TemplateTheme
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
  useGlobalBranding: true,
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
      tiktok: { enabled: false, url: '' },
      threads: { enabled: false, url: '' },
      flickr: { enabled: false, url: '' },
    },
    style: 'coloured',
    alignment: 'center',
  } as SocialBlockContent,
  html: {
    code: '<!-- Custom HTML here -->',
  } as HTMLBlockContent,
  section: {
    backgroundColor: '#0f172a',
    backgroundImageUrl: '',
    overlayOpacity: 0,
    textColor: '#ffffff',
    mutedColor: '#94a3b8',
    paddingY: 36,
    paddingX: 24,
    children: [],
  } as SectionBlockContent,
  hero: {
    imageUrl: '',
    heading: 'Your pathway starts here',
    subheading: 'Train, study and compete in England.',
    buttonText: 'Start your application',
    buttonUrl: '',
    overlayOpacity: 55,
    textColor: '#ffffff',
    alignment: 'center',
    height: 'medium',
    size: 'regular',
    // New heroes span the full width; anything already saved has no such
    // field and keeps its current inset rendering.
    fullBleed: true,
  } as HeroBlockContent,
  cards: {
    items: [
      { title: 'What you get', body: 'A full season of competitive football alongside your studies.', icon: '' },
      { title: 'What it costs', body: 'Everything is set out up front. No surprises later.', icon: '' },
    ],
    columns: 2,
    backgroundColor: '#f7f7f5',
    borderColor: '#e5e7eb',
    paddingTop: 10,
    paddingBottom: 10,
  } as CardsBlockContent,
  quote: {
    text: 'The best year of my life, on and off the pitch.',
    attribution: 'Former player, UK Gap Year',
    variant: 'quote',
    backgroundColor: '',
    accentColor: '',
    paddingTop: 16,
    paddingBottom: 16,
  } as QuoteBlockContent,
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
    showSignOff: true,
    signOff: 'Kind Regards,',
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
  // Defaults shipped to match the IFG email footer the team has been
  // using in AC. Logo URLs are placeholders pointing at the
  // /public/signatures directory so the editor preview shows real
  // partner logos out of the box; recruiters can swap them per
  // template (e.g. drop in a different university crest).
  company_signature: {
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
  } as CompanySignatureBlockContent,
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
