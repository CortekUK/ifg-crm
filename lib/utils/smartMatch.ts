import type { SupabaseClient } from '@supabase/supabase-js'
import type { Contact } from '@/lib/types/contacts'
import type { EmailReply } from '@/lib/types/email'
import type { SMSMessage } from '@/lib/types/sms'

export interface MatchSuggestion {
  replyId: string
  replyType: 'email' | 'sms'
  replyIdentifier: string // email address or phone number
  replyName: string | null
  replyPreview: string
  suggestedContact: Contact | null
  confidence: number
  matchReason: string
  createNew: boolean
  // Campaign pipeline data for deal creation
  campaignId: string | null
  campaignName: string | null // For activity logging
  campaignPipelineId: string | null // From reply.campaign?.pipeline_id
  aiIntent: string | null // From reply.ai_intent for determining positive intent
}

/**
 * QA-31 bug 1.
 *
 * Scoring used to run here, in the browser, over a `contacts` array the modal
 * fetched with `.select('*')` and no paging. PostgREST caps that at 1,000
 * rows, so against 179,468 contacts the matcher only ever saw "A…" to
 * "Abdiel": staff were shown "New contact" for players who plainly existed,
 * and the similar-name and similar-email tiers could never fire at all.
 *
 * The tiers now live in `suggest_contact_for_reply` / `suggest_contact_for_sms`
 * (migrations 207 and 208), where they can see every row and use the trigram
 * and phone-digit indexes. The thresholds and confidence bands are unchanged,
 * so a suggestion that was right before is still right — there are simply no
 * longer 178,468 contacts hidden from it.
 *
 * Levenshtein, stringSimilarity and normalizePhone were deleted rather than
 * kept alongside: two definitions of "matches" is how the contact search
 * drifted out of step with itself (see lib/contacts/search.ts).
 */

interface SuggestionRow {
  contact_id: string
  confidence: number
  match_reason: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>

/**
 * A readable name from an email address: `john.smith@…` → "John Smith".
 *
 * QA-31 bug 4: the modal showed a name built like this but saved something
 * else — the raw local part as the first name with the surname left empty, so
 * the contact `john.smith@…` created was called "john.smith". Exported as one
 * function so the preview and the INSERT cannot disagree again.
 */
export function tidyNameFromEmail(email: string): { firstName: string; lastName: string } {
  const localPart = (email.split('@')[0] || '').trim()
  const words = localPart
    .replace(/[._\-+]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())

  return {
    firstName: words[0] || localPart || 'Unknown',
    lastName: words.slice(1).join(' '),
  }
}

/** Split a display name from the sender's mail client into first / last. */
export function splitDisplayName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') }
}

/**
 * The name a new contact should be created with, and the name the preview
 * shows. Prefers the sender's own display name when the mail client sent one.
 */
export function newContactNameFor(suggestion: MatchSuggestion): {
  firstName: string
  lastName: string
} {
  if (suggestion.replyType === 'email') {
    if (suggestion.replyName) {
      const split = splitDisplayName(suggestion.replyName)
      if (split.firstName) return split
    }
    return tidyNameFromEmail(suggestion.replyIdentifier)
  }
  // A text gives us a number and nothing else.
  return { firstName: 'Unknown', lastName: suggestion.replyIdentifier }
}

/** Resolve the contact rows for a batch of suggestions in one round trip. */
async function attachContacts(
  supabase: Client,
  partials: (Omit<MatchSuggestion, 'suggestedContact' | 'createNew'> & {
    contactId: string | null
  })[],
): Promise<MatchSuggestion[]> {
  const ids = Array.from(
    new Set(partials.map((p) => p.contactId).filter((id): id is string => !!id)),
  )

  const byId = new Map<string, Contact>()
  if (ids.length > 0) {
    const { data, error } = await supabase.from('contacts').select('*').in('id', ids)
    if (error) throw error
    for (const c of (data || []) as Contact[]) byId.set(c.id, c)
  }

  return partials.map(({ contactId, ...rest }) => {
    const suggestedContact = contactId ? byId.get(contactId) ?? null : null
    return {
      ...rest,
      suggestedContact,
      createNew: !suggestedContact,
      // A suggestion we could not load the row for is not a suggestion.
      confidence: suggestedContact ? rest.confidence : 0,
      matchReason: suggestedContact ? rest.matchReason : 'No match found',
    }
  })
}

/** Analyse email replies, asking the database for each suggestion. */
export async function analyzeEmailReplies(
  supabase: Client,
  replies: EmailReply[],
): Promise<MatchSuggestion[]> {
  const partials = await Promise.all(
    replies.map(async (reply) => {
      const fromName = reply.from_name?.trim() || null

      const { data, error } = await supabase.rpc('suggest_contact_for_reply', {
        p_email: reply.from_email,
        p_name: fromName,
      })
      if (error) throw error

      const top = ((data || []) as SuggestionRow[])[0] ?? null

      return {
        replyId: reply.id,
        replyType: 'email' as const,
        replyIdentifier: reply.from_email,
        replyName: fromName,
        replyPreview: reply.subject || reply.body_preview || '(No content)',
        confidence: top?.confidence ?? 0,
        matchReason: top?.match_reason ?? 'No match found',
        campaignId: reply.campaign_id,
        campaignName: reply.campaign?.name || null,
        campaignPipelineId: reply.campaign?.pipeline_id || null,
        aiIntent: reply.ai_intent,
        contactId: top?.contact_id ?? null,
      }
    }),
  )

  return attachContacts(supabase, partials)
}

/** Analyse inbound texts, asking the database for each suggestion. */
export async function analyzeSMSMessages(
  supabase: Client,
  messages: SMSMessage[],
): Promise<MatchSuggestion[]> {
  const partials = await Promise.all(
    messages.map(async (message) => {
      const { data, error } = await supabase.rpc('suggest_contact_for_sms', {
        p_phone: message.phone_number,
      })
      if (error) throw error

      const top = ((data || []) as SuggestionRow[])[0] ?? null

      return {
        replyId: message.id,
        replyType: 'sms' as const,
        replyIdentifier: message.phone_number,
        replyName: null,
        replyPreview: message.content || '(No content)',
        confidence: top?.confidence ?? 0,
        matchReason: top?.match_reason ?? 'No match found',
        campaignId: null,
        campaignName: null,
        campaignPipelineId: message.pipeline_id || null,
        aiIntent: message.ai_intent || null,
        contactId: top?.contact_id ?? null,
      }
    }),
  )

  return attachContacts(supabase, partials)
}

/**
 * Get confidence level category
 */
export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' | 'none' {
  if (confidence >= 90) return 'high'
  if (confidence >= 70) return 'medium'
  if (confidence >= 50) return 'low'
  return 'none'
}
