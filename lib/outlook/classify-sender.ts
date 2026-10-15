import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Who sent this message, and what are they to us?
 *
 * One answer drives three things on screen: which folder the conversation
 * lands in, the tag on the list row, and the banner above the thread. Working
 * it out in one place is what stops a message reading "Player" in the list and
 * "Unknown sender" when you open it.
 *
 * Order matters and is deliberate:
 *   1. our own staff      — internal mail, never a lead
 *   2. a known contact    — player / parent / secondary, via the one SQL rule
 *   3. anything else      — unknown, i.e. waiting in Unmatched
 *
 * Staff is checked FIRST. A recruiter who is also in contacts (it happens —
 * someone imports a CSV containing their own address) would otherwise have
 * their internal mail filed as a player reply, which would put a colleague in
 * a pipeline.
 */
export type SenderKind = 'player' | 'parent' | 'secondary' | 'internal' | 'external' | 'unknown'

export interface SenderIdentity {
  kind: SenderKind
  contactId: string | null
}

export async function classifySender(
  supabase: SupabaseClient,
  email: string | null | undefined,
): Promise<SenderIdentity> {
  const address = (email ?? '').trim().toLowerCase()
  if (!address) return { kind: 'unknown', contactId: null }

  const { data: staff } = await supabase.rpc('is_staff_email', { p_email: address })
  if (staff === true) return { kind: 'internal', contactId: null }

  const { data } = await supabase.rpc('resolve_contact_by_email', { p_email: address })
  const row = (data as { contact_id: string; match_kind: SenderKind }[] | null)?.[0]
  if (row?.contact_id) return { kind: row.match_kind, contactId: row.contact_id }

  return { kind: 'unknown', contactId: null }
}

/**
 * The folder a conversation belongs to.
 *
 * A thread is only Unmatched while NOBODY in it is recognised. Once any
 * message is connected to a contact the whole conversation moves to Matched —
 * otherwise connecting one reply would leave its own thread sitting in two
 * folders at once.
 */
export function threadCategory(kinds: SenderKind[]): SenderKind {
  if (kinds.some((k) => k === 'player')) return 'player'
  if (kinds.some((k) => k === 'parent')) return 'parent'
  if (kinds.some((k) => k === 'secondary')) return 'secondary'
  if (kinds.length && kinds.every((k) => k === 'internal')) return 'internal'
  if (kinds.some((k) => k === 'external')) return 'external'
  return 'unknown'
}

/**
 * Folders in the left rail.
 *
 * Five, not the original six-plus-Internal. The mailbox is for conversations
 * with contacts and with people who might become one; mail between colleagues
 * is not what anyone opens this screen for, and the Internal folder held zero
 * threads from the day it shipped. External was the same.
 *
 * `waiting` is the one that earns its place: the last message came in and
 * nobody has answered it. "Where do I see replies I owe someone" was the
 * question this screen could not answer.
 */
export type MailFolder = 'inbox' | 'waiting' | 'unmatched' | 'matched' | 'sent'

/**
 * Sender kinds kept OUT of the mailbox entirely.
 *
 * A display filter, not a deletion: internal mail is still ingested, still in
 * email_replies, and still fires every trigger that hangs off that table. One
 * line to put it back if the decision changes.
 */
export const HIDDEN_CATEGORIES: SenderKind[] = ['internal']

export const FOLDER_CATEGORIES: Record<'unmatched' | 'matched', SenderKind[]> = {
  // 'external' is deliberately absent. Marking a sender external is how you
  // say "this is not a contact, stop asking" — putting it back in the queue
  // it was just dismissed from would make the button pointless. Those threads
  // stay in the Inbox, out of the way.
  unmatched: ['unknown'],
  matched: ['player', 'parent', 'secondary'],
}

/**
 * The tag shown on a list row — and only where it says something.
 *
 * Rows carried up to four pills, which is how a list stops being scannable.
 * A known contact is already evident from their name, so Player, Parent and
 * Secondary email earn nothing; what matters is whether a row still needs
 * somebody to link it. Everything else returns null and renders nothing.
 */
export function senderLabel(kind: SenderKind): string | null {
  switch (kind) {
    case 'unknown': return 'Not linked'
    default: return null
  }
}
