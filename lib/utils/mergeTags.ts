/**
 * Merge-tag editor surface for email templates.
 * Tag replacement itself lives in ./merge-tags-core.ts (mirrored to
 * supabase/functions/_shared/merge-tags.ts for the Deno executors).
 * This file adds the UI-facing catalog, preview, and validation helpers
 * that only the Next.js app needs.
 */

import { replaceMergeTags as coreReplaceMergeTags } from './merge-tags-core'
import type { MergeTagData as CoreMergeTagData } from './merge-tags-core'

// Re-export the type so existing imports from '@/lib/utils/mergeTags' keep working.
export type MergeTagData = CoreMergeTagData

export interface MergeTagDefinition {
  tag: string
  label: string
  category: 'contact' | 'deal' | 'owner' | 'meeting' | 'invoice' | 'custom'
  description: string
  example: string
}

/**
 * Available merge tags for the template editor
 */
export const MERGE_TAGS: MergeTagDefinition[] = [
  // Contact tags
  {
    tag: '{{first_name}}',
    label: 'First Name',
    category: 'contact',
    description: "Contact's first name",
    example: 'John',
  },
  {
    tag: '{{last_name}}',
    label: 'Last Name',
    category: 'contact',
    description: "Contact's last name",
    example: 'Smith',
  },
  {
    tag: '{{email}}',
    label: 'Email',
    category: 'contact',
    description: "Contact's email address",
    example: 'john@example.com',
  },
  {
    tag: '{{phone}}',
    label: 'Phone',
    category: 'contact',
    description: "Contact's phone number",
    example: '+44 7700 900123',
  },
  
  // Deal tags
  {
    tag: '{{deal_title}}',
    label: 'Deal Title',
    category: 'deal',
    description: 'Title of the deal',
    example: 'John Smith',
  },
  {
    tag: '{{deal_value}}',
    label: 'Deal Value',
    category: 'deal',
    description: 'Monetary value of the deal',
    example: '£5,000',
  },
  {
    tag: '{{deal_stage}}',
    label: 'Deal Stage',
    category: 'deal',
    description: 'Current stage of the deal',
    example: 'Initial Contact',
  },
  {
    tag: '{{deal_pipeline}}',
    label: 'Deal Pipeline',
    category: 'deal',
    description: 'Pipeline the deal belongs to',
    example: 'UK GAP 2026',
  },
  
  // Deal owner tags
  {
    tag: '{{deal_owner_name}}',
    label: 'Owner Name',
    category: 'owner',
    description: 'Full name of the deal owner',
    example: 'Nathan Recruiter',
  },
  {
    tag: '{{deal_owner_email}}',
    label: 'Owner Email',
    category: 'owner',
    description: 'Email address of the deal owner',
    example: 'nathan@ifg.com',
  },
  {
    tag: '{{deal_owner_phone}}',
    label: 'Owner Phone',
    category: 'owner',
    description: 'Phone number of the deal owner',
    example: '+44 7700 900456',
  },
  {
    tag: '{{deal_owner_calendly}}',
    label: 'Calendly Link',
    category: 'owner',
    description: 'Calendly scheduling link of the deal owner',
    example: 'https://calendly.com/nathan',
  },
  {
    tag: '{{deal_owner_signature}}',
    label: 'Email Signature',
    category: 'owner',
    description: 'Email signature of the deal owner',
    example: 'Best regards,\nNathan',
  },

  // Meeting / Calendly tags. {{schedule_link}} is the recruiter's Calendly
  // booking page (use this for "Schedule Your Meeting" CTAs). The other
  // four come from the deal's most recent booked Calendly event and are
  // ideal for reminder emails sent before the meeting.
  {
    tag: '{{schedule_link}}',
    label: 'Schedule Link',
    category: 'meeting',
    description: 'Recruiter\'s Calendly booking link (for "schedule a meeting" CTAs)',
    example: 'https://calendly.com/nathan/30min',
  },
  {
    tag: '{{meeting_link}}',
    label: 'Meeting Join Link',
    category: 'meeting',
    description: 'Live Google Meet/Zoom link for the booked meeting',
    example: 'https://meet.google.com/xyz-abc-def',
  },
  {
    tag: '{{meeting_time}}',
    label: 'Meeting Time',
    category: 'meeting',
    description: 'Booked meeting date and time, formatted human-readable',
    example: 'Mon, 15 Jan 2026 at 3:00 PM',
  },
  {
    tag: '{{interview_date}}',
    label: 'Interview Date',
    category: 'meeting',
    description: 'Deal\'s interview date (set by Calendly booking or manually)',
    example: 'Mon, 15 Jan 2026 at 3:00 PM',
  },
  {
    tag: '{{meeting_event_name}}',
    label: 'Meeting Event Name',
    category: 'meeting',
    description: 'Name of the Calendly event type (e.g. "30 Minute Meeting")',
    example: '30 Minute Meeting',
  },

  // Invoice tags. Resolved from the deal's most recent unpaid invoice
  // (status sent or overdue). invoice_payment_link routes through
  // /pay/<id> which generates a Stripe Checkout Session on demand.
  {
    tag: '{{invoice_payment_link}}',
    label: 'Invoice Payment Link',
    category: 'invoice',
    description: 'Public payment link for the deal\'s most recent unpaid invoice — opens Stripe Checkout',
    example: 'https://ifg-crm.vercel.app/pay/abc-123',
  },
  {
    tag: '{{invoice_number}}',
    label: 'Invoice Number',
    category: 'invoice',
    description: 'Number of the deal\'s most recent unpaid invoice',
    example: 'IFG-2026-00043',
  },
  {
    tag: '{{invoice_amount}}',
    label: 'Invoice Amount',
    category: 'invoice',
    description: 'Amount due, formatted as currency',
    example: '£1,500.00',
  },
  {
    tag: '{{invoice_due_date}}',
    label: 'Invoice Due Date',
    category: 'invoice',
    description: 'Due date of the deal\'s most recent unpaid invoice',
    example: '15 January 2026',
  },
]

/**
 * Get merge tags grouped by category
 */
export function getMergeTagsByCategory(): Record<string, MergeTagDefinition[]> {
  return MERGE_TAGS.reduce((acc, tag) => {
    if (!acc[tag.category]) {
      acc[tag.category] = []
    }
    acc[tag.category].push(tag)
    return acc
  }, {} as Record<string, MergeTagDefinition[]>)
}

/**
 * Get category display name
 */
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    contact: 'Contact',
    deal: 'Deal',
    owner: 'Deal Owner',
    meeting: 'Meeting',
    invoice: 'Invoice',
    custom: 'Custom',
  }
  return labels[category] || category
}

// Core replacement is delegated to merge-tags-core so the Next.js app and
// the Deno edge functions share identical behaviour.
export const replaceMergeTags = coreReplaceMergeTags

/**
 * Preview merge tags with sample data
 */
export function previewMergeTags(template: string): string {
  const sampleData: MergeTagData = {
    first_name: 'John',
    last_name: 'Smith',
    email: 'john.smith@example.com',
    phone: '+44 7700 900123',
    deal_title: 'John Smith',
    deal_value: 5000,
    deal_stage: 'Initial Contact',
    deal_pipeline: 'UK GAP 2026',
    deal_owner_name: 'Nathan Recruiter',
    deal_owner_email: 'nathan@ifg.com',
    deal_owner_phone: '+44 7700 900456',
    deal_owner_calendly: 'https://calendly.com/nathan-ifg',
    deal_owner_signature: 'Best regards,<br>Nathan Recruiter<br>International Football Group',
    schedule_link: 'https://calendly.com/nathan-ifg/30min',
    meeting_link: 'https://meet.google.com/xyz-abc-def',
    meeting_time: 'Mon, 15 Jan 2026 at 3:00 PM',
    interview_date: 'Mon, 15 Jan 2026 at 3:00 PM',
    meeting_event_name: '30 Minute Meeting',
    invoice_payment_link: 'https://ifg-crm.vercel.app/pay/abc-123',
    invoice_number: 'IFG-2026-00043',
    invoice_amount: '£1,500.00',
    invoice_due_date: '15 January 2026',
  }
  
  return replaceMergeTags(template, sampleData)
}

/**
 * Validate merge tags in a template
 * Returns list of invalid/unknown tags
 */
export function validateMergeTags(template: string): string[] {
  const validTags = MERGE_TAGS.map(t => t.tag.replace(/[{}]/g, ''))
  const invalidTags: string[] = []
  
  // Find all tags in template
  const tagPattern = /\{\{(\w+)(?:\|[^}]+)?\}\}/g
  let match
  
  while ((match = tagPattern.exec(template)) !== null) {
    const tagName = match[1]
    if (!validTags.includes(tagName)) {
      invalidTags.push(tagName)
    }
  }
  
  return [...new Set(invalidTags)]
}

/**
 * Extract all merge tags used in a template
 */
export function extractMergeTags(template: string): string[] {
  const tags: string[] = []
  const tagPattern = /\{\{(\w+)(?:\|[^}]+)?\}\}/g
  let match
  
  while ((match = tagPattern.exec(template)) !== null) {
    tags.push(match[1])
  }
  
  return [...new Set(tags)]
}

/**
 * Check if template contains any merge tags
 */
export function hasMergeTags(template: string): boolean {
  return /\{\{[\w|]+\}\}/.test(template)
}
