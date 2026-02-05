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
}

/**
 * Normalize a phone number for comparison
 * Removes all non-digit characters and handles UK formats
 */
function normalizePhone(phone: string): string {
  // Remove all non-digits
  let normalized = phone.replace(/\D/g, '')

  // Handle UK numbers: convert 07xxx to 447xxx
  if (normalized.startsWith('0') && normalized.length === 11) {
    normalized = '44' + normalized.slice(1)
  }

  // Remove leading 44 for comparison (we'll compare last 10 digits)
  if (normalized.startsWith('44')) {
    normalized = normalized.slice(2)
  }

  return normalized
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 * Returns a score from 0 to 1
 */
function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  if (s1 === s2) return 1
  if (s1.length === 0 || s2.length === 0) return 0

  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1

  const longerLength = longer.length
  if (longerLength === 0) return 1

  const distance = levenshteinDistance(longer, shorter)
  return (longerLength - distance) / longerLength
}

/**
 * Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }

  return dp[m][n]
}

/**
 * Get email domain from email address
 */
function getEmailDomain(email: string): string {
  return email.toLowerCase().split('@')[1] || ''
}

/**
 * Find best matching contact for an email reply
 */
function findEmailMatch(reply: EmailReply, contacts: Contact[]): MatchSuggestion {
  const fromEmail = reply.from_email.toLowerCase()
  const fromName = reply.from_name?.trim() || null

  let bestMatch: Contact | null = null
  let bestConfidence = 0
  let matchReason = ''

  for (const contact of contacts) {
    const contactEmail = contact.email?.toLowerCase() || ''
    const contactName = `${contact.first_name} ${contact.last_name}`.trim()

    // Exact email match - 100% confidence
    if (contactEmail && contactEmail === fromEmail) {
      return {
        replyId: reply.id,
        replyType: 'email',
        replyIdentifier: reply.from_email,
        replyName: fromName,
        replyPreview: reply.subject || reply.body_preview || '(No content)',
        suggestedContact: contact,
        confidence: 100,
        matchReason: 'Exact email match',
        createNew: false,
      }
    }

    // Email domain + name similarity
    if (contactEmail && fromName && getEmailDomain(contactEmail) === getEmailDomain(fromEmail)) {
      const nameSimilarity = stringSimilarity(fromName, contactName)
      if (nameSimilarity > 0.7) {
        const confidence = Math.round(70 + nameSimilarity * 25) // 70-95%
        if (confidence > bestConfidence) {
          bestConfidence = confidence
          bestMatch = contact
          matchReason = `Same domain + name match (${Math.round(nameSimilarity * 100)}%)`
        }
      }
    }

    // Name similarity only (if name is provided)
    if (fromName && !bestMatch) {
      const nameSimilarity = stringSimilarity(fromName, contactName)
      if (nameSimilarity > 0.85) {
        const confidence = Math.round(50 + nameSimilarity * 30) // 50-80%
        if (confidence > bestConfidence) {
          bestConfidence = confidence
          bestMatch = contact
          matchReason = `Name similarity (${Math.round(nameSimilarity * 100)}%)`
        }
      }
    }
  }

  return {
    replyId: reply.id,
    replyType: 'email',
    replyIdentifier: reply.from_email,
    replyName: fromName,
    replyPreview: reply.subject || reply.body_preview || '(No content)',
    suggestedContact: bestMatch,
    confidence: bestConfidence,
    matchReason: bestMatch ? matchReason : 'No match found',
    createNew: !bestMatch,
  }
}

/**
 * Find best matching contact for an SMS message
 */
function findSMSMatch(message: SMSMessage, contacts: Contact[]): MatchSuggestion {
  const messagePhone = normalizePhone(message.phone_number)

  let bestMatch: Contact | null = null
  let bestConfidence = 0
  let matchReason = ''

  for (const contact of contacts) {
    if (!contact.phone) continue

    const contactPhone = normalizePhone(contact.phone)

    // Exact phone match - 100% confidence
    if (contactPhone === messagePhone) {
      return {
        replyId: message.id,
        replyType: 'sms',
        replyIdentifier: message.phone_number,
        replyName: null,
        replyPreview: message.content || '(No content)',
        suggestedContact: contact,
        confidence: 100,
        matchReason: 'Exact phone match',
        createNew: false,
      }
    }

    // Partial phone match - last 10 digits
    const messageLast10 = messagePhone.slice(-10)
    const contactLast10 = contactPhone.slice(-10)

    if (messageLast10.length >= 10 && messageLast10 === contactLast10) {
      const confidence = 90
      if (confidence > bestConfidence) {
        bestConfidence = confidence
        bestMatch = contact
        matchReason = 'Phone match (last 10 digits)'
      }
    }

    // Partial match - last 9 digits (handles some edge cases)
    const messageLast9 = messagePhone.slice(-9)
    const contactLast9 = contactPhone.slice(-9)

    if (!bestMatch && messageLast9.length >= 9 && messageLast9 === contactLast9) {
      const confidence = 80
      if (confidence > bestConfidence) {
        bestConfidence = confidence
        bestMatch = contact
        matchReason = 'Phone match (partial)'
      }
    }
  }

  return {
    replyId: message.id,
    replyType: 'sms',
    replyIdentifier: message.phone_number,
    replyName: null,
    replyPreview: message.content || '(No content)',
    suggestedContact: bestMatch,
    confidence: bestConfidence,
    matchReason: bestMatch ? matchReason : 'No match found',
    createNew: !bestMatch,
  }
}

/**
 * Analyze email replies and find matching contacts
 */
export function analyzeEmailReplies(
  replies: EmailReply[],
  contacts: Contact[]
): MatchSuggestion[] {
  return replies.map((reply) => findEmailMatch(reply, contacts))
}

/**
 * Analyze SMS messages and find matching contacts
 */
export function analyzeSMSMessages(
  messages: SMSMessage[],
  contacts: Contact[]
): MatchSuggestion[] {
  return messages.map((message) => findSMSMatch(message, contacts))
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
