// Schema bridge between OpenAI structured-output and the editor's EditorBlock.
//
// The full EditorBlock shape (lib/templates/editor-types.ts) is too detailed
// to ask GPT to fill out reliably — every block has 8+ styling props. So we
// give the model a *simplified* "AiBlock" schema: just the semantic fields
// (text, url, alignment, etc.) and let the server expand each AiBlock into a
// full EditorBlock with defaultBlockContent merged in.
//
// This keeps the OpenAI schema tractable AND keeps the canvas rendering
// path identical for AI-generated and hand-built blocks — once they're
// EditorBlocks they're indistinguishable downstream.

import { z } from 'zod'
import type {
  EditorBlock,
  TextBlockContent,
  ButtonBlockContent,
  DividerBlockContent,
  SpacerBlockContent,
  ImageBlockContent,
  RecruiterSignatureBlockContent,
  HTMLBlockContent,
  VideoBlockContent,
  SocialBlockContent,
  ColumnsBlockContent,
} from './editor-types'
import { defaultBlockContent } from './editor-types'

// ---------------------------------------------------------------------------
// AiBlock — what GPT emits.
// ---------------------------------------------------------------------------

const alignmentSchema = z.enum(['left', 'center', 'right'])
const fontSizeSchema = z.enum(['small', 'normal', 'large', 'xlarge'])
const dividerStyleSchema = z.enum(['solid', 'dashed', 'dotted'])
const imageWidthSchema = z.enum(['full', 'large', 'medium', 'small'])
const headingLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)])

// .nullish() instead of .optional() because the OpenAI JSON Schema we send
// uses anyOf:[enum, null] for nullable fields — the model legitimately
// returns null when it has no preference, and Zod's .optional() rejects
// null. .nullish() accepts both null and undefined (treated as "use the
// default" downstream in expandAiBlock).
// Reusable padding shape — every visual block accepts these so the AI can
// breathe room in/out a section ("add more padding under the title").
const paddingTop = z.number().int().min(0).max(80).nullish()
const paddingBottom = z.number().int().min(0).max(80).nullish()

const textBlockSchema = z.object({
  type: z.literal('text'),
  html: z
    .string()
    .describe(
      'The paragraph content as simple HTML. Allowed tags: p, br, strong, em, u, a (with href), ul, ol, li, span. Inline styling via style="color: …" or style="background: …" on span tags is supported when the user wants partial colouring (e.g. one red word in a sentence). Use {{first_name|there}} style merge tags freely.',
    ),
  alignment: alignmentSchema.nullish(),
  size: fontSizeSchema.nullish(),
  color: z
    .string()
    .nullish()
    .describe(
      'Optional hex colour applied to the WHOLE block as the foreground text colour, e.g. "#ef4444" for red. Use only when the user asks for the entire block to be a colour; for partial colouring put a span style="color:..." inside the html instead.',
    ),
  background: z
    .string()
    .nullish()
    .describe('Optional hex colour applied as the block background, e.g. "#fff7ed".'),
  paddingTop,
  paddingBottom,
})

const headingBlockSchema = z.object({
  type: z.literal('heading'),
  text: z.string().describe('Plain heading text. Will render bold + larger.'),
  level: headingLevelSchema
    .nullish()
    .describe('1 = biggest, 3 = smallest. Defaults to 2.'),
  alignment: alignmentSchema.nullish(),
  color: z
    .string()
    .nullish()
    .describe(
      'Optional hex colour for the heading text, e.g. "#ef4444" for red, "#0f172a" for slate-900. Always supply this when the user asks for a coloured title.',
    ),
  background: z.string().nullish().describe('Optional hex background colour for the heading row.'),
  paddingTop,
  paddingBottom,
})

const buttonBlockSchema = z.object({
  type: z.literal('button'),
  text: z.string().describe('Button label text. Keep it short and action-oriented.'),
  url: z.string().describe(
    'Destination URL. Use merge tags like {{deal_owner_calendly}} or {{invoice_payment_link}} when relevant — leave as a plain placeholder URL only if no merge tag fits.',
  ),
  color: z
    .string()
    .nullish()
    .describe('Hex colour for the button background, e.g. "#3b82f6". Defaults to brand blue.'),
  textColor: z
    .string()
    .nullish()
    .describe('Hex colour for the button text/label, e.g. "#ffffff". Defaults to white.'),
  alignment: alignmentSchema.nullish(),
  borderRadius: z
    .number()
    .int()
    .min(0)
    .max(40)
    .nullish()
    .describe('Corner radius in px. 0 = sharp, 6 = default, 24+ = pill.'),
  width: z
    .enum(['auto', '50', '75', 'full'])
    .nullish()
    .describe(
      'auto = sized to text; 50/75 = % of column width; full = stretch to fill. Use full for hero CTAs, auto for inline asks.',
    ),
  paddingTop,
  paddingBottom,
})

const dividerBlockSchema = z.object({
  type: z.literal('divider'),
  style: dividerStyleSchema.nullish(),
  color: z
    .string()
    .nullish()
    .describe('Hex colour for the divider line, e.g. "#e5e7eb" (default light grey).'),
  thickness: z
    .number()
    .int()
    .min(1)
    .max(8)
    .nullish()
    .describe('Line thickness in px. 1 = hairline, 2 = default, 4+ = strong.'),
  width: z
    .enum(['25', '50', '75', '100'])
    .nullish()
    .describe('Width as a percentage of the column. 100 = full width (default).'),
  paddingTop,
  paddingBottom,
})

const spacerBlockSchema = z.object({
  type: z.literal('spacer'),
  height: z.number().int().min(8).max(80).nullish(),
})

const imageBlockSchema = z.object({
  type: z.literal('image'),
  url: z.string().describe(
    'Image URL. Only emit an image block if the user explicitly asks for one or supplies a URL — do NOT invent placeholder image URLs.',
  ),
  alt: z.string().nullish(),
  alignment: alignmentSchema.nullish(),
  width: imageWidthSchema.nullish(),
  linkUrl: z
    .string()
    .nullish()
    .describe(
      'Optional URL to wrap the image in a link (the whole image becomes clickable). Use merge tags when relevant.',
    ),
  paddingTop,
  paddingBottom,
})

const signatureBlockSchema = z.object({
  type: z.literal('recruiter_signature'),
  showPhoto: z.boolean().nullish().describe('Deprecated — block no longer renders a photo. Set to false / leave null.'),
  showName: z.boolean().nullish(),
  showTitle: z.boolean().nullish().describe('Whether to render the recruiter\'s job title.'),
  showEmail: z.boolean().nullish(),
  showPhone: z.boolean().nullish(),
  showCalendly: z
    .boolean()
    .nullish()
    .describe('Whether to render the recruiter\'s Calendly booking link.'),
  layout: z
    .enum(['stacked', 'inline'])
    .nullish()
    .describe('Deprecated — block always renders stacked-style now. Leave null.'),
  alignment: alignmentSchema.nullish(),
  photoSize: z
    .enum(['small', 'medium', 'large'])
    .nullish()
    .describe('Deprecated — no photo to size.'),
  textColor: z
    .string()
    .nullish()
    .describe(
      'Hex colour applied ONLY to the variable details (name, title, email, phone, Calendly). Does NOT touch the company-info line or the confidentiality disclaimer — set those via companyTextColor / confidentialityColor instead.',
    ),
  companyTextColor: z
    .string()
    .nullish()
    .describe(
      'Hex colour applied ONLY to the "Macc Football Club Limited, a company registered…" registered-office line.',
    ),
  confidentialityColor: z
    .string()
    .nullish()
    .describe(
      'Hex colour applied ONLY to the "Confidentiality: …" disclaimer paragraph.',
    ),
  paddingTop,
  paddingBottom,
})

const htmlBlockSchema = z.object({
  type: z.literal('html'),
  code: z
    .string()
    .describe(
      'Custom HTML snippet. Will be sanitised server-side — script/iframe/style/event-handlers are stripped. Use this only when no other block type fits (e.g. a small inline-styled callout, an image with custom flexbox).',
    ),
})

const videoBlockSchema = z.object({
  type: z.literal('video'),
  url: z
    .string()
    .describe(
      'YouTube / Vimeo / Loom URL. Leave as an empty string when the user has not supplied one — the editor will show a placeholder until they fill it in.',
    ),
  thumbnailUrl: z.string().nullish(),
  alignment: alignmentSchema.nullish(),
  // 'full' or a numeric pixel width up to ~600. We allow either via union.
  width: z.union([z.literal('full'), z.number().int().min(120).max(800)]).nullish(),
})

// Social block: each platform is { enabled, url }. We let the AI pick which
// platforms to enable; URLs default to empty strings the user fills in
// later (sensible because IFG-wide social URLs aren't in the merge-tag
// catalogue yet).
const socialPlatformsSchema = z.object({
  facebook: z.object({ enabled: z.boolean(), url: z.string().nullish() }).nullish(),
  twitter: z.object({ enabled: z.boolean(), url: z.string().nullish() }).nullish(),
  instagram: z.object({ enabled: z.boolean(), url: z.string().nullish() }).nullish(),
  linkedin: z.object({ enabled: z.boolean(), url: z.string().nullish() }).nullish(),
  youtube: z.object({ enabled: z.boolean(), url: z.string().nullish() }).nullish(),
})

const socialBlockSchema = z.object({
  type: z.literal('social'),
  platforms: socialPlatformsSchema,
  style: z.enum(['coloured', 'monochrome']).nullish(),
  alignment: alignmentSchema.nullish(),
})

// Columns: a non-recursive subset for nested children. Lets the AI build
// 2- or 3-column layouts without us paying the cost of fully recursive
// schema (which OpenAI handles unevenly across snapshots).
const basicAiBlockSchema = z.discriminatedUnion('type', [
  textBlockSchema,
  headingBlockSchema,
  buttonBlockSchema,
  dividerBlockSchema,
  spacerBlockSchema,
  imageBlockSchema,
])

export type BasicAiBlock = z.infer<typeof basicAiBlockSchema>

const columnsBlockSchema = z.object({
  type: z.literal('columns'),
  columns: z.union([z.literal(2), z.literal(3)]).describe('Number of columns: 2 or 3.'),
  leftBlocks: z.array(basicAiBlockSchema).describe('Blocks rendered in the left column.'),
  rightBlocks: z.array(basicAiBlockSchema).describe('Blocks rendered in the right column.'),
  centerBlocks: z
    .array(basicAiBlockSchema)
    .nullish()
    .describe('Blocks rendered in the centre column. Only used when columns = 3.'),
})

export const aiBlockSchema = z.discriminatedUnion('type', [
  textBlockSchema,
  headingBlockSchema,
  buttonBlockSchema,
  dividerBlockSchema,
  spacerBlockSchema,
  imageBlockSchema,
  signatureBlockSchema,
  htmlBlockSchema,
  videoBlockSchema,
  socialBlockSchema,
  columnsBlockSchema,
])

export type AiBlock = z.infer<typeof aiBlockSchema>

export const aiTemplateResponseSchema = z.object({
  // What the model is trying to do for this turn. The model decides this
  // itself; the client's mode hint is only a tip.
  //   answer  — the user is asking a question, asking for advice, asking
  //             for reference content / examples / suggestions, or
  //             otherwise NOT requesting a canvas change. Reply only.
  //             name/subject/blocks should be empty.
  //   create  — generate a brand-new template. Replaces the canvas.
  //   enhance — modify the existing canvas. Reuses untouched blocks.
  intent: z
    .enum(['answer', 'create', 'enhance'])
    .describe(
      'What the assistant is doing this turn. "answer" = chat-only, no canvas change. "create" = build a fresh template. "enhance" = edit the existing canvas.',
    ),
  // Always required. The conversational message shown in the chat thread.
  // For create/enhance turns it should briefly describe what the model
  // built (tone, structure, why those choices). For answer turns it carries
  // the full answer (references, suggestions, advice, etc.).
  reply: z
    .string()
    .min(1)
    .max(4000)
    .describe(
      'The natural-language message to show the user in chat. ALWAYS required, even on create/enhance turns. Friendly, brief, no headers — write like Claude.',
    ),
  // Internal name shown in the templates list — short and scannable, NOT
  // the subject line. Two to five words, title-cased. Examples: "Summer
  // Residency Welcome", "Interview Confirmation", "Deposit Reminder",
  // "Onboarding Day 1". The user can rename later. Empty string on
  // 'answer' intent.
  name: z
    .string()
    .max(80)
    .describe(
      'Short internal name (2-5 words, title case) for create/enhance. Empty string when intent is "answer".',
    ),
  subject: z
    .string()
    .max(200)
    .describe(
      'Email subject line for create/enhance. Empty string when intent is "answer".',
    ),
  preheader: z
    .string()
    .max(200)
    .nullish()
    .describe('Optional preview text shown after the subject in the inbox list.'),
  blocks: z
    .array(aiBlockSchema)
    .max(40)
    .describe(
      'Ordered list of blocks for create/enhance. Empty array when intent is "answer".',
    ),
  // Per-template theme override. The model uses this to honour
  // requests like "change the header colour to red" or "make the
  // page background cream" — without this it would otherwise drop a
  // custom html block on top, which is wrong. When no theme change is
  // intended, return null.
  theme: z
    .object({
      headerBgColor: z.string().nullish(),
      headerTextColor: z.string().nullish(),
      footerBgColor: z.string().nullish(),
      footerTextColor: z.string().nullish(),
      footerLinkColor: z.string().nullish(),
      pageBgColor: z.string().nullish(),
      bodyBgColor: z.string().nullish(),
    })
    .nullish()
    .describe(
      'Optional theme overrides for the email chrome (header/footer/page bg). Set ONLY the keys the user asked you to change; leave the rest null. Set the whole object to null when the user did not ask for a chrome / theme change.',
    ),
})

export type AiTemplateResponse = z.infer<typeof aiTemplateResponseSchema>

// ---------------------------------------------------------------------------
// JSON Schema for OpenAI structured outputs.
// We hand-write this to match aiTemplateResponseSchema but in the exact
// shape OpenAI requires (all properties required, additionalProperties:false,
// strict literal discriminators).
// ---------------------------------------------------------------------------

// Strict-mode JSON Schema for OpenAI structured outputs.
//
// Rules we obey (verified against OpenAI's structured-outputs docs):
//   * every object lists every key in `required`
//   * every object sets `additionalProperties: false`
//   * we use `enum` for discriminator and constraint values (no `const`,
//     since some snapshots rejected `const` mixed with anyOf branches)
//   * nullable fields are written as `anyOf: [{type: 'string', enum: […]}, {type: 'null'}]`
//     rather than `type: ['string','null']` — the latter mixed with `enum`
//     was the schema shape that gpt-4o-2024-08-06 rejected with a 400.
//
// If we ever expand the block set, add the new branch to `items.anyOf` AND
// the matching Zod variant in aiBlockSchema.

const nullableEnum = (values: readonly (string | number)[]) => ({
  anyOf: [
    { type: typeof values[0] === 'number' ? 'integer' : 'string', enum: [...values] },
    { type: 'null' },
  ],
})

const nullableString = () => ({
  anyOf: [{ type: 'string' }, { type: 'null' }],
})

const nullableInteger = () => ({
  anyOf: [{ type: 'integer' }, { type: 'null' }],
})

const nullableBoolean = () => ({
  anyOf: [{ type: 'boolean' }, { type: 'null' }],
})

// Branches reused both at the top level and (a non-recursive subset) inside
// the columns block. Defined as plain JS objects so we can reference them
// in two places — OpenAI's strict mode mostly avoids $ref because some
// snapshots reject schemas that lean on it.
const textBranch = {
  type: 'object',
  additionalProperties: false,
  required: [
    'type', 'html', 'alignment', 'size', 'color', 'background',
    'paddingTop', 'paddingBottom',
  ],
  properties: {
    type: { type: 'string', enum: ['text'] },
    html: { type: 'string' },
    alignment: nullableEnum(['left', 'center', 'right']),
    size: nullableEnum(['small', 'normal', 'large', 'xlarge']),
    color: nullableString(),
    background: nullableString(),
    paddingTop: nullableInteger(),
    paddingBottom: nullableInteger(),
  },
}
const headingBranch = {
  type: 'object',
  additionalProperties: false,
  required: [
    'type', 'text', 'level', 'alignment', 'color', 'background',
    'paddingTop', 'paddingBottom',
  ],
  properties: {
    type: { type: 'string', enum: ['heading'] },
    text: { type: 'string' },
    level: nullableEnum([1, 2, 3]),
    alignment: nullableEnum(['left', 'center', 'right']),
    color: nullableString(),
    background: nullableString(),
    paddingTop: nullableInteger(),
    paddingBottom: nullableInteger(),
  },
}
const buttonBranch = {
  type: 'object',
  additionalProperties: false,
  required: [
    'type', 'text', 'url', 'color', 'textColor', 'alignment',
    'borderRadius', 'width', 'paddingTop', 'paddingBottom',
  ],
  properties: {
    type: { type: 'string', enum: ['button'] },
    text: { type: 'string' },
    url: { type: 'string' },
    color: nullableString(),
    textColor: nullableString(),
    alignment: nullableEnum(['left', 'center', 'right']),
    borderRadius: nullableInteger(),
    width: nullableEnum(['auto', '50', '75', 'full']),
    paddingTop: nullableInteger(),
    paddingBottom: nullableInteger(),
  },
}
const dividerBranch = {
  type: 'object',
  additionalProperties: false,
  required: [
    'type', 'style', 'color', 'thickness', 'width',
    'paddingTop', 'paddingBottom',
  ],
  properties: {
    type: { type: 'string', enum: ['divider'] },
    style: nullableEnum(['solid', 'dashed', 'dotted']),
    color: nullableString(),
    thickness: nullableInteger(),
    width: nullableEnum(['25', '50', '75', '100']),
    paddingTop: nullableInteger(),
    paddingBottom: nullableInteger(),
  },
}
const spacerBranch = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'height'],
  properties: {
    type: { type: 'string', enum: ['spacer'] },
    height: nullableInteger(),
  },
}
const imageBranch = {
  type: 'object',
  additionalProperties: false,
  required: [
    'type', 'url', 'alt', 'alignment', 'width', 'linkUrl',
    'paddingTop', 'paddingBottom',
  ],
  properties: {
    type: { type: 'string', enum: ['image'] },
    url: { type: 'string' },
    alt: nullableString(),
    alignment: nullableEnum(['left', 'center', 'right']),
    width: nullableEnum(['full', 'large', 'medium', 'small']),
    linkUrl: nullableString(),
    paddingTop: nullableInteger(),
    paddingBottom: nullableInteger(),
  },
}
const signatureBranch = {
  type: 'object',
  additionalProperties: false,
  required: [
    'type', 'showPhoto', 'showName', 'showTitle', 'showEmail',
    'showPhone', 'showCalendly', 'layout', 'alignment', 'photoSize',
    'textColor', 'companyTextColor', 'confidentialityColor',
    'paddingTop', 'paddingBottom',
  ],
  properties: {
    type: { type: 'string', enum: ['recruiter_signature'] },
    showPhoto: nullableBoolean(),
    showName: nullableBoolean(),
    showTitle: nullableBoolean(),
    showEmail: nullableBoolean(),
    showPhone: nullableBoolean(),
    showCalendly: nullableBoolean(),
    layout: nullableEnum(['stacked', 'inline']),
    alignment: nullableEnum(['left', 'center', 'right']),
    photoSize: nullableEnum(['small', 'medium', 'large']),
    textColor: nullableString(),
    companyTextColor: nullableString(),
    confidentialityColor: nullableString(),
    paddingTop: nullableInteger(),
    paddingBottom: nullableInteger(),
  },
}
const htmlBranch = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'code'],
  properties: {
    type: { type: 'string', enum: ['html'] },
    code: { type: 'string' },
  },
}
const videoBranch = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'url', 'thumbnailUrl', 'alignment', 'width'],
  properties: {
    type: { type: 'string', enum: ['video'] },
    url: { type: 'string' },
    thumbnailUrl: nullableString(),
    alignment: nullableEnum(['left', 'center', 'right']),
    // Width is either the literal "full" or a pixel integer. We model it
    // as a nullable string here for simplicity — the AI almost always picks
    // 'full' anyway.
    width: nullableEnum(['full']),
  },
}
const socialBranch = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'platforms', 'style', 'alignment'],
  properties: {
    type: { type: 'string', enum: ['social'] },
    platforms: {
      type: 'object',
      additionalProperties: false,
      required: ['facebook', 'twitter', 'instagram', 'linkedin', 'youtube'],
      properties: {
        facebook: socialPlatformObjectSchema(),
        twitter: socialPlatformObjectSchema(),
        instagram: socialPlatformObjectSchema(),
        linkedin: socialPlatformObjectSchema(),
        youtube: socialPlatformObjectSchema(),
      },
    },
    style: nullableEnum(['coloured', 'monochrome']),
    alignment: nullableEnum(['left', 'center', 'right']),
  },
}

function socialPlatformObjectSchema() {
  return {
    anyOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['enabled', 'url'],
        properties: {
          enabled: { type: 'boolean' },
          url: nullableString(),
        },
      },
      { type: 'null' },
    ],
  }
}

// Basic blocks allowed inside columns — non-recursive. Excludes columns
// itself, conditional, social, video, html so we never get unbounded
// nesting that OpenAI's strict mode struggles with.
const basicBlockBranches = [
  textBranch,
  headingBranch,
  buttonBranch,
  dividerBranch,
  spacerBranch,
  imageBranch,
]

const columnsBranch = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'columns', 'leftBlocks', 'rightBlocks', 'centerBlocks'],
  properties: {
    type: { type: 'string', enum: ['columns'] },
    columns: { type: 'integer', enum: [2, 3] },
    leftBlocks: { type: 'array', items: { anyOf: basicBlockBranches } },
    rightBlocks: { type: 'array', items: { anyOf: basicBlockBranches } },
    centerBlocks: {
      anyOf: [
        { type: 'array', items: { anyOf: basicBlockBranches } },
        { type: 'null' },
      ],
    },
  },
}

export const openAiJsonSchema = {
  name: 'EmailTemplate',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['intent', 'reply', 'name', 'subject', 'preheader', 'blocks', 'theme'],
    properties: {
      intent: {
        type: 'string',
        enum: ['answer', 'create', 'enhance'],
        description:
          '"answer" = chat-only (no canvas change). "create" = build a new template. "enhance" = edit the existing canvas.',
      },
      reply: {
        type: 'string',
        description:
          'Conversational message shown in the chat thread. ALWAYS required. For create/enhance, briefly describe what you built. For answer, this is the full reply.',
      },
      name: {
        type: 'string',
        description:
          'Short internal name for the template (2-5 words, title case). Empty string on "answer".',
      },
      subject: {
        type: 'string',
        description: 'Concise subject line. Empty string on "answer".',
      },
      preheader: nullableString(),
      blocks: {
        type: 'array',
        items: {
          anyOf: [
            textBranch,
            headingBranch,
            buttonBranch,
            dividerBranch,
            spacerBranch,
            imageBranch,
            signatureBranch,
            htmlBranch,
            videoBranch,
            socialBranch,
            columnsBranch,
          ],
        },
      },
      theme: {
        anyOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: [
              'headerBgColor',
              'headerTextColor',
              'footerBgColor',
              'footerTextColor',
              'footerLinkColor',
              'pageBgColor',
              'bodyBgColor',
            ],
            properties: {
              headerBgColor: nullableString(),
              headerTextColor: nullableString(),
              footerBgColor: nullableString(),
              footerTextColor: nullableString(),
              footerLinkColor: nullableString(),
              pageBgColor: nullableString(),
              bodyBgColor: nullableString(),
            },
          },
          { type: 'null' },
        ],
      },
    },
  },
} as const

// ---------------------------------------------------------------------------
// AiBlock → EditorBlock expansion.
// ---------------------------------------------------------------------------

// Lightweight HTML sanitiser — strips the tags the editor doesn't render
// anyway and the obviously-dangerous ones (script/iframe/style/object/embed
// /form/etc.), plus all `on*=` event handlers and `javascript:` URLs in
// href/src. Not a substitute for DOMPurify in a browser-trusting context,
// but the AI output is generated server-side from a constrained schema and
// only ever renders inside our own editor, so the threat model is small.
//
// We deliberately keep this dependency-free so the route loads cleanly in
// the Next.js Node runtime without pulling in jsdom.
const DANGEROUS_TAG = /<\s*(script|iframe|style|object|embed|form|input|button|link|meta|base)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi
const DANGEROUS_SELF_CLOSING = /<\s*(script|iframe|style|object|embed|form|input|button|link|meta|base)\b[^>]*\/?\s*>/gi
const ON_HANDLERS = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi
const JS_URL = /\b(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi
const DATA_URL_BLACKLIST = /\b(href|src)\s*=\s*("data:[^"]*"|'data:[^']*')/gi

function sanitizeHtml(input: string): string {
  if (!input) return ''
  return input
    .replace(DANGEROUS_TAG, '')
    .replace(DANGEROUS_SELF_CLOSING, '')
    .replace(ON_HANDLERS, '')
    .replace(JS_URL, '$1=""')
    .replace(DATA_URL_BLACKLIST, '$1=""')
}

// Tight colour validator. Accepts #rgb / #rrggbb / #rrggbbaa hex and a
// short list of named CSS colours. Returns null for anything else so the
// AI can't smuggle url(javascript:…) or other style-tag tricks through a
// "colour" field.
const NAMED_COLOURS = new Set([
  'red', 'green', 'blue', 'black', 'white', 'gray', 'grey',
  'yellow', 'orange', 'purple', 'pink', 'brown', 'navy', 'teal',
  'cyan', 'magenta', 'lime', 'olive', 'maroon', 'silver', 'gold',
  'transparent', 'inherit', 'currentcolor',
])
function sanitiseColour(input: string): string {
  const v = String(input ?? '').trim().toLowerCase()
  if (/^#[0-9a-f]{3}$/.test(v)) return v
  if (/^#[0-9a-f]{6}$/.test(v)) return v
  if (/^#[0-9a-f]{8}$/.test(v)) return v
  if (NAMED_COLOURS.has(v)) return v
  // rgb()/rgba() with simple integer/decimal arguments only.
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)$/.test(v)) return v
  return ''
}

// Wrap the user-supplied html in a span that carries a foreground colour
// without breaking inline styling already inside the html. We emit at the
// outermost level so per-character colours nested inside still win.
function wrapWithColor(html: string, color: string): string {
  const safe = sanitiseColour(color)
  if (!safe) return html
  return `<span style="color:${safe}">${html}</span>`
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'block-' + Math.random().toString(36).slice(2)
}

const SIZE_BY_HEADING_LEVEL: Record<1 | 2 | 3, TextBlockContent['fontSize']> = {
  1: 'xlarge',
  2: 'large',
  3: 'normal',
}

const IMAGE_WIDTH_MAP: Record<'full' | 'large' | 'medium' | 'small', string> = {
  full: '100',
  large: '75',
  medium: '50',
  small: '25',
}

export function expandAiBlock(ai: AiBlock): EditorBlock {
  switch (ai.type) {
    case 'text': {
      // Apply block-level colour by wrapping the html in an outer span. We
      // do this on the html so the editor's existing rendering path picks
      // it up — no changes to TextBlockContent shape needed.
      const sanitised = sanitizeHtml(ai.html)
      const html = ai.color ? wrapWithColor(sanitised, ai.color) : sanitised
      const base = defaultBlockContent.text as TextBlockContent
      const content: TextBlockContent = {
        ...base,
        html,
        alignment: ai.alignment ?? 'left',
        fontSize: ai.size ?? 'normal',
        paddingTop: ai.paddingTop ?? base.paddingTop,
        paddingBottom: ai.paddingBottom ?? base.paddingBottom,
        ...(ai.background ? { backgroundColor: sanitiseColour(ai.background) } : {}),
      }
      return { id: newId(), type: 'text', content }
    }
    case 'heading': {
      // Headings ride on the text block — bold + larger size — so they share
      // the same renderer and styling utilities as body copy.
      const level = (ai.level ?? 2) as 1 | 2 | 3
      const safeText = sanitizeHtml(ai.text)
      const colour = ai.color ? sanitiseColour(ai.color) : null
      const inner = colour
        ? `<span style="color:${colour}"><strong>${safeText}</strong></span>`
        : `<strong>${safeText}</strong>`
      const base = defaultBlockContent.text as TextBlockContent
      const content: TextBlockContent = {
        ...base,
        html: `<p>${inner}</p>`,
        alignment: ai.alignment ?? 'left',
        fontSize: SIZE_BY_HEADING_LEVEL[level],
        paddingTop: ai.paddingTop ?? 14,
        paddingBottom: ai.paddingBottom ?? 6,
        ...(ai.background ? { backgroundColor: sanitiseColour(ai.background) } : {}),
      }
      return { id: newId(), type: 'text', content }
    }
    case 'button': {
      const base = defaultBlockContent.button as ButtonBlockContent
      const content: ButtonBlockContent = {
        ...base,
        text: ai.text,
        url: ai.url,
        backgroundColor: ai.color ? sanitiseColour(ai.color) || base.backgroundColor : base.backgroundColor,
        textColor: ai.textColor ? sanitiseColour(ai.textColor) || base.textColor : base.textColor,
        alignment: ai.alignment ?? 'center',
        borderRadius: ai.borderRadius ?? base.borderRadius,
        width: ai.width ?? base.width,
        paddingTop: ai.paddingTop ?? base.paddingTop,
        paddingBottom: ai.paddingBottom ?? base.paddingBottom,
      }
      return { id: newId(), type: 'button', content }
    }
    case 'divider': {
      const base = defaultBlockContent.divider as DividerBlockContent
      const content: DividerBlockContent = {
        ...base,
        style: ai.style ?? base.style,
        color: ai.color ? sanitiseColour(ai.color) || base.color : base.color,
        thickness: ai.thickness ?? base.thickness,
        width: ai.width ?? base.width,
        paddingTop: ai.paddingTop ?? base.paddingTop,
        paddingBottom: ai.paddingBottom ?? base.paddingBottom,
      }
      return { id: newId(), type: 'divider', content }
    }
    case 'spacer': {
      const content: SpacerBlockContent = {
        ...(defaultBlockContent.spacer as SpacerBlockContent),
        height: ai.height ?? 20,
      }
      return { id: newId(), type: 'spacer', content }
    }
    case 'image': {
      const base = defaultBlockContent.image as ImageBlockContent
      const content: ImageBlockContent = {
        ...base,
        src: ai.url,
        alt: ai.alt ?? '',
        alignment: ai.alignment ?? 'center',
        width: IMAGE_WIDTH_MAP[ai.width ?? 'full'],
        linkUrl: ai.linkUrl ?? undefined,
        paddingTop: ai.paddingTop ?? base.paddingTop,
        paddingBottom: ai.paddingBottom ?? base.paddingBottom,
      }
      return { id: newId(), type: 'image', content }
    }
    case 'recruiter_signature': {
      const base = defaultBlockContent.recruiter_signature as RecruiterSignatureBlockContent
      // For booleans we use ?? so an explicit false survives — the user
      // saying "hide the phone" must result in showPhone: false, not the
      // default true.
      const content: RecruiterSignatureBlockContent = {
        ...base,
        showPhoto: ai.showPhoto ?? base.showPhoto,
        showName: ai.showName ?? base.showName,
        showTitle: ai.showTitle ?? base.showTitle,
        showEmail: ai.showEmail ?? base.showEmail,
        showPhone: ai.showPhone ?? base.showPhone,
        showCalendly: ai.showCalendly ?? base.showCalendly,
        layout: ai.layout ?? base.layout,
        alignment: ai.alignment ?? base.alignment,
        photoSize: ai.photoSize ?? base.photoSize,
        textColor: ai.textColor ? sanitiseColour(ai.textColor) || null : null,
        companyTextColor: ai.companyTextColor
          ? sanitiseColour(ai.companyTextColor) || null
          : null,
        confidentialityColor: ai.confidentialityColor
          ? sanitiseColour(ai.confidentialityColor) || null
          : null,
        paddingTop: ai.paddingTop ?? base.paddingTop,
        paddingBottom: ai.paddingBottom ?? base.paddingBottom,
      }
      return { id: newId(), type: 'recruiter_signature', content }
    }
    case 'html': {
      const content: HTMLBlockContent = {
        ...(defaultBlockContent.html as HTMLBlockContent),
        // Sanitise even more aggressively for the html block — the same
        // regex sweep we use for text + a hard cap on length so a runaway
        // model can't paste a megabyte of markup.
        code: sanitizeHtml(ai.code).slice(0, 5000),
      }
      return { id: newId(), type: 'html', content }
    }
    case 'video': {
      // The width field in EditorBlock is `number | 'full'`. The AI schema
      // allows either, but for OpenAI strict-mode simplicity the JSON
      // Schema only accepts 'full' (or null) — numeric override stays an
      // editor-level fine-tune. ai.width therefore narrows to 'full' | null.
      const aiWidth = ai.width
      const width: VideoBlockContent['width'] =
        typeof aiWidth === 'number' ? aiWidth : 'full'
      const content: VideoBlockContent = {
        ...(defaultBlockContent.video as VideoBlockContent),
        url: ai.url,
        thumbnailUrl: ai.thumbnailUrl ?? undefined,
        alignment: ai.alignment ?? 'center',
        width,
      }
      return { id: newId(), type: 'video', content }
    }
    case 'social': {
      const base = defaultBlockContent.social as SocialBlockContent
      const merged: SocialBlockContent['platforms'] = {
        facebook: { ...base.platforms.facebook, ...mergeSocialPlatform(ai.platforms.facebook) },
        twitter: { ...base.platforms.twitter, ...mergeSocialPlatform(ai.platforms.twitter) },
        instagram: { ...base.platforms.instagram, ...mergeSocialPlatform(ai.platforms.instagram) },
        linkedin: { ...base.platforms.linkedin, ...mergeSocialPlatform(ai.platforms.linkedin) },
        youtube: { ...base.platforms.youtube, ...mergeSocialPlatform(ai.platforms.youtube) },
      }
      const content: SocialBlockContent = {
        ...base,
        platforms: merged,
        style: ai.style ?? base.style,
        alignment: ai.alignment ?? base.alignment,
      }
      return { id: newId(), type: 'social', content }
    }
    case 'columns': {
      // Nested children come from the basic-block subset; reuse the same
      // expansion pipeline for them. We don't recurse into 'columns' /
      // other complex types here because the schema disallows them.
      const left = (ai.leftBlocks ?? []).map(expandBasicAiBlock)
      const right = (ai.rightBlocks ?? []).map(expandBasicAiBlock)
      const center = (ai.centerBlocks ?? []).map(expandBasicAiBlock)
      const cols = ai.columns
      // Match the editor's column-width convention: even split for now.
      const widths = cols === 3 ? [33, 33, 34] : [50, 50]
      const content: ColumnsBlockContent = {
        ...(defaultBlockContent.columns as ColumnsBlockContent),
        columns: cols,
        columnWidths: widths,
        leftBlocks: left,
        rightBlocks: right,
        ...(cols === 3 ? { centerBlocks: center } : {}),
      }
      return { id: newId(), type: 'columns', content }
    }
  }
}

// Helper: nudge an AI-side platform object onto our canonical shape (always
// produces `{ enabled, url }`). null/undefined → keep the default.
function mergeSocialPlatform(
  ai: { enabled: boolean; url?: string | null } | null | undefined,
): { enabled: boolean; url: string } | object {
  if (!ai) return {}
  return {
    enabled: ai.enabled,
    url: ai.url ?? '',
  }
}

// Expansion path for blocks that live INSIDE a columns block. Strictly the
// non-recursive subset — the schema disallows nested columns / signatures /
// social / video / html so we never see them here, but the type narrowing
// is enforced by basicAiBlockSchema's discriminated union.
function expandBasicAiBlock(ai: BasicAiBlock): EditorBlock {
  return expandAiBlock(ai as AiBlock)
}

export function expandAiBlocks(ai: AiBlock[]): EditorBlock[] {
  return ai.map(expandAiBlock)
}

// ---------------------------------------------------------------------------
// Preservation-aware merge (used by enhance mode).
//
// Why this exists: when the user asks for a small change ("make the title
// bold", "change one word"), the AI returns the WHOLE template. If we just
// expand every returned block we lose the user's custom paddings, colours,
// and the stable block ids — even on blocks that didn't actually change.
//
// Strategy: pair each AI-returned block with the original at the same index.
// If their compact representations are content-equal, reuse the original
// EditorBlock verbatim. Otherwise expand the new one. Extra returned blocks
// (the AI added something) are expanded; missing originals (AI removed
// something) are dropped.
// ---------------------------------------------------------------------------

function normaliseHtml(html: string): string {
  return html
    .replace(/\s+/g, ' ') // collapse whitespace
    .replace(/>\s+</g, '><') // strip whitespace between tags
    .trim()
    .toLowerCase()
}

function compactEqual(a: AiBlock | null, b: AiBlock | null): boolean {
  if (!a || !b) return false
  if (a.type !== b.type) return false
  switch (a.type) {
    case 'text':
      return (
        normaliseHtml(a.html) === normaliseHtml((b as typeof a).html) &&
        (a.alignment ?? null) === ((b as typeof a).alignment ?? null) &&
        (a.size ?? null) === ((b as typeof a).size ?? null) &&
        (a.color ?? null) === ((b as typeof a).color ?? null) &&
        (a.background ?? null) === ((b as typeof a).background ?? null) &&
        (a.paddingTop ?? null) === ((b as typeof a).paddingTop ?? null) &&
        (a.paddingBottom ?? null) === ((b as typeof a).paddingBottom ?? null)
      )
    case 'button':
      return (
        a.text === (b as typeof a).text &&
        a.url === (b as typeof a).url &&
        (a.color ?? null) === ((b as typeof a).color ?? null) &&
        (a.textColor ?? null) === ((b as typeof a).textColor ?? null) &&
        (a.alignment ?? null) === ((b as typeof a).alignment ?? null) &&
        (a.borderRadius ?? null) === ((b as typeof a).borderRadius ?? null) &&
        (a.width ?? null) === ((b as typeof a).width ?? null) &&
        (a.paddingTop ?? null) === ((b as typeof a).paddingTop ?? null) &&
        (a.paddingBottom ?? null) === ((b as typeof a).paddingBottom ?? null)
      )
    case 'divider':
      return (
        (a.style ?? null) === ((b as typeof a).style ?? null) &&
        (a.color ?? null) === ((b as typeof a).color ?? null) &&
        (a.thickness ?? null) === ((b as typeof a).thickness ?? null) &&
        (a.width ?? null) === ((b as typeof a).width ?? null) &&
        (a.paddingTop ?? null) === ((b as typeof a).paddingTop ?? null) &&
        (a.paddingBottom ?? null) === ((b as typeof a).paddingBottom ?? null)
      )
    case 'spacer':
      return (a.height ?? null) === ((b as typeof a).height ?? null)
    case 'image':
      return (
        a.url === (b as typeof a).url &&
        (a.alt ?? null) === ((b as typeof a).alt ?? null) &&
        (a.alignment ?? null) === ((b as typeof a).alignment ?? null) &&
        (a.width ?? null) === ((b as typeof a).width ?? null) &&
        (a.linkUrl ?? null) === ((b as typeof a).linkUrl ?? null) &&
        (a.paddingTop ?? null) === ((b as typeof a).paddingTop ?? null) &&
        (a.paddingBottom ?? null) === ((b as typeof a).paddingBottom ?? null)
      )
    case 'heading':
      return (
        a.text === (b as typeof a).text &&
        (a.level ?? null) === ((b as typeof a).level ?? null) &&
        (a.alignment ?? null) === ((b as typeof a).alignment ?? null) &&
        (a.color ?? null) === ((b as typeof a).color ?? null) &&
        (a.background ?? null) === ((b as typeof a).background ?? null) &&
        (a.paddingTop ?? null) === ((b as typeof a).paddingTop ?? null) &&
        (a.paddingBottom ?? null) === ((b as typeof a).paddingBottom ?? null)
      )
    case 'recruiter_signature': {
      const bSig = b as typeof a
      return (
        (a.showPhoto ?? null) === (bSig.showPhoto ?? null) &&
        (a.showName ?? null) === (bSig.showName ?? null) &&
        (a.showTitle ?? null) === (bSig.showTitle ?? null) &&
        (a.showEmail ?? null) === (bSig.showEmail ?? null) &&
        (a.showPhone ?? null) === (bSig.showPhone ?? null) &&
        (a.showCalendly ?? null) === (bSig.showCalendly ?? null) &&
        (a.layout ?? null) === (bSig.layout ?? null) &&
        (a.alignment ?? null) === (bSig.alignment ?? null) &&
        (a.photoSize ?? null) === (bSig.photoSize ?? null) &&
        (a.textColor ?? null) === (bSig.textColor ?? null) &&
        (a.companyTextColor ?? null) === (bSig.companyTextColor ?? null) &&
        (a.confidentialityColor ?? null) === (bSig.confidentialityColor ?? null) &&
        (a.paddingTop ?? null) === (bSig.paddingTop ?? null) &&
        (a.paddingBottom ?? null) === (bSig.paddingBottom ?? null)
      )
    }
    case 'html':
      return normaliseHtml(a.code) === normaliseHtml((b as typeof a).code)
    case 'video':
      return (
        a.url === (b as typeof a).url &&
        (a.thumbnailUrl ?? null) === ((b as typeof a).thumbnailUrl ?? null) &&
        (a.alignment ?? null) === ((b as typeof a).alignment ?? null) &&
        (a.width ?? null) === ((b as typeof a).width ?? null)
      )
    case 'social': {
      const bSocial = b as typeof a
      const platformsEqual = (
        ['facebook', 'twitter', 'instagram', 'linkedin', 'youtube'] as const
      ).every((key) => {
        const left = a.platforms[key]
        const right = bSocial.platforms[key]
        if (!left && !right) return true
        if (!left || !right) return false
        return left.enabled === right.enabled && (left.url ?? null) === (right.url ?? null)
      })
      return (
        platformsEqual &&
        (a.style ?? null) === (bSocial.style ?? null) &&
        (a.alignment ?? null) === (bSocial.alignment ?? null)
      )
    }
    case 'columns': {
      const bCols = b as typeof a
      if (a.columns !== bCols.columns) return false
      if (a.leftBlocks.length !== bCols.leftBlocks.length) return false
      if (a.rightBlocks.length !== bCols.rightBlocks.length) return false
      const eqList = (l: BasicAiBlock[], r: BasicAiBlock[]) =>
        l.every((x, i) => compactEqual(x as AiBlock, r[i] as AiBlock))
      if (!eqList(a.leftBlocks, bCols.leftBlocks)) return false
      if (!eqList(a.rightBlocks, bCols.rightBlocks)) return false
      const aCenter = a.centerBlocks ?? []
      const bCenter = bCols.centerBlocks ?? []
      if (aCenter.length !== bCenter.length) return false
      return eqList(aCenter, bCenter)
    }
    default:
      return false
  }
}

export function mergeAiBlocksWithExisting(
  aiBlocks: AiBlock[],
  existingFullBlocks: EditorBlock[],
): EditorBlock[] {
  // Compact each existing block once so we can compare in O(N).
  const existingCompact = existingFullBlocks.map(compactBlockForPrompt)
  const result: EditorBlock[] = []

  for (let i = 0; i < aiBlocks.length; i++) {
    const aiBlock = aiBlocks[i]
    const originalCompact = existingCompact[i] ?? null
    const originalFull = existingFullBlocks[i]

    if (originalFull && compactEqual(aiBlock, originalCompact)) {
      // The model returned this slot unchanged — reuse the original block
      // verbatim so its id, custom paddings, colours etc. survive.
      result.push(originalFull)
    } else {
      result.push(expandAiBlock(aiBlock))
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// EditorBlock → AiBlock compaction (for the "enhance" flow).
// We feed the model only what it needs to understand existing content,
// dropping the verbose styling fields it didn't author. If a block type
// can't be cleanly compacted (columns/conditional/html/video/social/file),
// we drop it from the prompt context — the model still preserves it via
// the `keepBlocks` array we pass alongside.
// ---------------------------------------------------------------------------

export function compactBlockForPrompt(block: EditorBlock): AiBlock | null {
  const c = block.content as Record<string, unknown>
  switch (block.type) {
    case 'text': {
      // Reverse-engineer color/background from the rendered HTML + the
      // backgroundColor field so the model sees what's currently in place
      // when it's asked to enhance. Pulled from a leading <span style=
      // "color:…">…</span> wrapper if present.
      const rawHtml = String(c.html ?? '')
      const colorMatch = rawHtml.match(/^<span style="color:([^"]+)">([\s\S]*)<\/span>$/)
      return {
        type: 'text',
        html: colorMatch ? colorMatch[2] : rawHtml,
        alignment: c.alignment as 'left' | 'center' | 'right' | undefined,
        size: c.fontSize as 'small' | 'normal' | 'large' | 'xlarge' | undefined,
        color: colorMatch ? colorMatch[1] : undefined,
        background: c.backgroundColor ? String(c.backgroundColor) : undefined,
        paddingTop: typeof c.paddingTop === 'number' ? c.paddingTop : undefined,
        paddingBottom: typeof c.paddingBottom === 'number' ? c.paddingBottom : undefined,
      }
    }
    case 'button':
      return {
        type: 'button',
        text: String(c.text ?? ''),
        url: String(c.url ?? ''),
        color: c.backgroundColor ? String(c.backgroundColor) : undefined,
        textColor: c.textColor ? String(c.textColor) : undefined,
        alignment: c.alignment as 'left' | 'center' | 'right' | undefined,
        borderRadius:
          typeof c.borderRadius === 'number' ? c.borderRadius : undefined,
        width: c.width as 'auto' | '50' | '75' | 'full' | undefined,
        paddingTop: typeof c.paddingTop === 'number' ? c.paddingTop : undefined,
        paddingBottom: typeof c.paddingBottom === 'number' ? c.paddingBottom : undefined,
      }
    case 'divider':
      return {
        type: 'divider',
        style: c.style as 'solid' | 'dashed' | 'dotted' | undefined,
        color: c.color ? String(c.color) : undefined,
        thickness:
          typeof c.thickness === 'number' ? c.thickness : undefined,
        width: c.width as '25' | '50' | '75' | '100' | undefined,
        paddingTop: typeof c.paddingTop === 'number' ? c.paddingTop : undefined,
        paddingBottom: typeof c.paddingBottom === 'number' ? c.paddingBottom : undefined,
      }
    case 'spacer':
      return {
        type: 'spacer',
        height: typeof c.height === 'number' ? c.height : undefined,
      }
    case 'image':
      return {
        type: 'image',
        url: String(c.src ?? ''),
        alt: c.alt ? String(c.alt) : undefined,
        alignment: c.alignment as 'left' | 'center' | 'right' | undefined,
        linkUrl: c.linkUrl ? String(c.linkUrl) : undefined,
        paddingTop: typeof c.paddingTop === 'number' ? c.paddingTop : undefined,
        paddingBottom: typeof c.paddingBottom === 'number' ? c.paddingBottom : undefined,
      }
    case 'recruiter_signature':
      return {
        type: 'recruiter_signature',
        showPhoto: typeof c.showPhoto === 'boolean' ? c.showPhoto : undefined,
        showName: typeof c.showName === 'boolean' ? c.showName : undefined,
        showTitle: typeof c.showTitle === 'boolean' ? c.showTitle : undefined,
        showEmail: typeof c.showEmail === 'boolean' ? c.showEmail : undefined,
        showPhone: typeof c.showPhone === 'boolean' ? c.showPhone : undefined,
        showCalendly:
          typeof c.showCalendly === 'boolean' ? c.showCalendly : undefined,
        layout: c.layout as 'stacked' | 'inline' | undefined,
        alignment: c.alignment as 'left' | 'center' | 'right' | undefined,
        photoSize: c.photoSize as 'small' | 'medium' | 'large' | undefined,
        textColor: typeof c.textColor === 'string' ? c.textColor : undefined,
        companyTextColor:
          typeof c.companyTextColor === 'string' ? c.companyTextColor : undefined,
        confidentialityColor:
          typeof c.confidentialityColor === 'string' ? c.confidentialityColor : undefined,
        paddingTop: typeof c.paddingTop === 'number' ? c.paddingTop : undefined,
        paddingBottom: typeof c.paddingBottom === 'number' ? c.paddingBottom : undefined,
      }
    case 'html':
      return { type: 'html', code: String(c.code ?? '') }
    case 'video':
      return {
        type: 'video',
        url: String(c.url ?? ''),
        thumbnailUrl: c.thumbnailUrl ? String(c.thumbnailUrl) : undefined,
        alignment: c.alignment as 'left' | 'center' | 'right' | undefined,
        width: c.width === 'full' ? 'full' : undefined,
      }
    case 'social': {
      const platforms = (c.platforms ?? {}) as Record<
        string,
        { enabled?: boolean; url?: string }
      >
      const platSchema = (key: string) => ({
        enabled: !!platforms[key]?.enabled,
        url: platforms[key]?.url ?? null,
      })
      return {
        type: 'social',
        platforms: {
          facebook: platSchema('facebook'),
          twitter: platSchema('twitter'),
          instagram: platSchema('instagram'),
          linkedin: platSchema('linkedin'),
          youtube: platSchema('youtube'),
        },
        style: c.style as 'coloured' | 'monochrome' | undefined,
        alignment: c.alignment as 'left' | 'center' | 'right' | undefined,
      }
    }
    case 'columns': {
      const left = Array.isArray(c.leftBlocks)
        ? (c.leftBlocks as EditorBlock[]).map(compactBlockForPrompt).filter(isBasic)
        : []
      const right = Array.isArray(c.rightBlocks)
        ? (c.rightBlocks as EditorBlock[]).map(compactBlockForPrompt).filter(isBasic)
        : []
      const center = Array.isArray(c.centerBlocks)
        ? (c.centerBlocks as EditorBlock[]).map(compactBlockForPrompt).filter(isBasic)
        : null
      const cols = (c.columns === 3 ? 3 : 2) as 2 | 3
      return {
        type: 'columns',
        columns: cols,
        leftBlocks: left,
        rightBlocks: right,
        centerBlocks: center && center.length > 0 ? center : undefined,
      }
    }
    default:
      return null
  }
}

// Type guard for the basic-block subset, used when collecting compacted
// children of a columns block.
const BASIC_TYPES: ReadonlySet<string> = new Set([
  'text',
  'heading',
  'button',
  'divider',
  'spacer',
  'image',
])
function isBasic(b: AiBlock | null): b is BasicAiBlock {
  return !!b && BASIC_TYPES.has(b.type)
}
