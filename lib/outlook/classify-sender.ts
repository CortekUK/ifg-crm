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

/** Folders in the left rail, and what each one holds. */
export type MailFolder = 'inbox' | 'unmatched' | 'matched' | 'sent' | 'internal' | 'external'

export const FOLDER_CATEGORIES: Record<Exclude<MailFolder, 'inbox' | 'sent'>, SenderKind[]> = {
  unmatched: ['unknown'],
  matched: ['player', 'parent', 'secondary'],
  internal: ['internal'],
  external: ['external'],
}

/** The tag shown on a list row, in the words the screen uses. */
export function senderLabel(kind: SenderKind): string | null {
  switch (kind) {
    case 'player': return 'Player'
    case 'parent': return 'Parent'
    case 'secondary': return 'Secondary email'
    case 'internal': return 'Internal'
    case 'external': return 'External'
    case 'unknown': return 'Unmatched'
    default: return null
  }
}
