/**
 * What the CRM can export, and what each export needs.
 *
 * Metadata only — no queries, no server imports — so the Reports page and
 * the API route work from one list and cannot drift apart. The runners
 * live in `lib/reports/runners.ts`, which is server-only.
 */

export type ReportCategory = 'pipeline' | 'finance' | 'marketing' | 'operations'

export interface ReportDefinition {
  id: string
  name: string
  description: string
  category: ReportCategory
  /** Show a programme picker for this report. */
  pipelineFilter?: boolean
  /** Show a recruiter picker for this report. */
  recruiterFilter?: boolean
  /**
   * A snapshot of current state rather than a window of history. The date
   * pickers are hidden, because filtering "what is unpaid right now" by a
   * creation date answers a different question than the one being asked.
   */
  snapshot?: boolean
}

export const REPORT_CATEGORIES: { id: ReportCategory; label: string; description: string }[] = [
  {
    id: 'pipeline',
    label: 'Pipeline & people',
    description: 'Deals, stage movement, and who is working what.',
  },
  {
    id: 'finance',
    label: 'Revenue & finance',
    description: 'Money in, money owed, and deposit conversion.',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    description: 'Campaigns, email delivery, replies and brochures.',
  },
  {
    id: 'operations',
    label: 'Operations',
    description: 'Full data exports, form submissions and automation activity.',
  },
]

export const REPORTS: ReportDefinition[] = [
  // ---- Pipeline & people ----
  {
    id: 'deals',
    name: 'Deals',
    description: 'Every deal with its player, programme, stage, owner and value.',
    category: 'pipeline',
    pipelineFilter: true,
    recruiterFilter: true,
  },
  {
    id: 'stage-movements',
    name: 'Stage movements',
    description: 'Every stage change, with who moved it and how long it had sat there.',
    category: 'pipeline',
    pipelineFilter: true,
  },
  {
    id: 'recruiters',
    name: 'Recruiter performance',
    description: 'Deals owned, won and lost per recruiter, with pipeline value.',
    category: 'pipeline',
    recruiterFilter: true,
  },
  {
    id: 'monthly-summary',
    name: 'Summary metrics',
    description: 'One row per headline figure for the selected period.',
    category: 'pipeline',
    pipelineFilter: true,
  },

  // ---- Revenue & finance ----
  {
    id: 'payments',
    name: 'Payments received',
    description: 'Successful payments with the invoice and player they belong to.',
    category: 'finance',
    pipelineFilter: true,
  },
  {
    id: 'invoices',
    name: 'Invoices',
    description: 'All invoices raised, with status, amount and due date.',
    category: 'finance',
    pipelineFilter: true,
  },
  {
    id: 'invoice-ageing',
    name: 'Invoice ageing',
    description: 'Unpaid invoices right now, bracketed by how overdue they are.',
    category: 'finance',
    pipelineFilter: true,
    snapshot: true,
  },
  {
    id: 'deposit-conversion',
    name: 'Deposit conversion',
    description: 'Deposits raised, paid, and how many became enrolments, per programme.',
    category: 'finance',
    pipelineFilter: true,
  },

  // ---- Marketing ----
  {
    id: 'campaigns',
    name: 'Campaign performance',
    description: 'Each campaign with recipients, delivery and engagement counts.',
    category: 'marketing',
  },
  {
    id: 'campaign-conversions',
    name: 'Campaign conversions',
    description: 'How many recipients of each campaign went on to become deals.',
    category: 'marketing',
    pipelineFilter: true,
  },
  {
    id: 'email-sends',
    name: 'Email delivery log',
    description: 'Every email sent, to whom, and what happened to it.',
    category: 'marketing',
  },
  {
    id: 'email-replies',
    name: 'Replies received',
    description: 'Inbound email replies, and whether they were matched to a player.',
    category: 'marketing',
  },
  {
    id: 'brochure-leads',
    name: 'Brochure downloads',
    description: 'Who requested which brochure, and the deal it created.',
    category: 'marketing',
  },

  // ---- Operations ----
  {
    id: 'contacts',
    name: 'Contacts export',
    description: 'Every contact with their details, source and subscription status.',
    category: 'operations',
  },
  {
    id: 'form-submissions',
    name: 'Website form submissions',
    description: 'Raw submissions from the website, including any that failed to process.',
    category: 'operations',
  },
  {
    id: 'automations',
    name: 'Automation activity',
    description: 'Every automation step that ran, with its outcome and any error.',
    category: 'operations',
    pipelineFilter: true,
  },
  {
    id: 'audience',
    name: 'Lists & tags',
    description: 'Every list and tag with how many contacts it holds.',
    category: 'operations',
    snapshot: true,
  },
]

export function findReport(id: string): ReportDefinition | undefined {
  return REPORTS.find((r) => r.id === id)
}
