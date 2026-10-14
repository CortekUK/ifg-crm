/** The subset of a Microsoft Graph message we actually read. */
export interface GraphRecipient {
  emailAddress?: { address?: string | null; name?: string | null } | null
}

export interface GraphMessage {
  id: string
  internetMessageId?: string | null
  conversationId?: string | null
  subject?: string | null
  bodyPreview?: string | null
  body?: { contentType?: string | null; content?: string | null } | null
  from?: GraphRecipient | null
  sender?: GraphRecipient | null
  toRecipients?: GraphRecipient[] | null
  ccRecipients?: GraphRecipient[] | null
  receivedDateTime?: string | null
  sentDateTime?: string | null
  isRead?: boolean | null
  isDraft?: boolean | null
  internetMessageHeaders?: { name: string; value: string }[] | null
  hasAttachments?: boolean | null
}

/** The fields Graph must return for the ingest to work. */
export const MESSAGE_SELECT = [
  'id',
  'internetMessageId',
  'conversationId',
  'subject',
  'bodyPreview',
  'body',
  'from',
  'sender',
  'toRecipients',
  'ccRecipients',
  'receivedDateTime',
  'sentDateTime',
  'isRead',
  'isDraft',
  'hasAttachments',
].join(',')

export function addressOf(recipient: GraphRecipient | null | undefined): string | null {
  const address = recipient?.emailAddress?.address
  return address ? address.trim().toLowerCase() : null
}

export function nameOf(recipient: GraphRecipient | null | undefined): string | null {
  return recipient?.emailAddress?.name?.trim() || null
}

export function headersToRecord(
  headers: { name: string; value: string }[] | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const h of headers ?? []) {
    if (h?.name) out[h.name] = h.value
  }
  return out
}
