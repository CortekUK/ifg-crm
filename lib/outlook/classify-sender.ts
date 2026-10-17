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
export type SenderKind = 'player' | 'parent' | 'secondary' | 'internal' | 'external' | 'vendor' | 'unknown'

/**
 * Addresses no human reads a reply from — and which nobody opens this mailbox
 * to find.
 *
 * Measured against the 246 unmatched threads actually sitting in the mailbox
 * rather than guessed at. The local part is the signal; the domain is not.
 * A domain blocklist would have to chase calendly, zoom, southwest, brighthr,
 * openai, xero, constant contact and whatever is signed up for next, while
 * these patterns catch 95 of those threads with nothing to maintain:
 *
 *   notifications  54    no-reply       17    noreply         9
 *   donotreply      5    no-reply-aws    3    mailer-daemon   3
 *   messaging-service 2  microsoftexchange<hex>  2
 *
 * Deliberately narrow. admin@, accounts@, info@, training@, support@ and
 * theteam@ are NOT here: they are shared human mailboxes, and at a football
 * club and a university they are exactly the addresses a real conversation
 * arrives from. Hiding a person is far worse than leaving a robot on screen.
 */
const VENDOR_LOCAL_PART =
  /^(no[-_.]?reply|do[-_.]?not[-_.]?reply|mailer[-_]?daemon$|postmaster$|notifications?([-_.]|$)|bounces?([-_.]|$)|automated|auto[-_]?reply|auto[-_]?confirm|messaging[-_]service$|microsoftexchange[0-9a-f]{16,}$)/

/**
 * Mail-sending infrastructure. Never a person, whatever the local part says —
 * Constant Contact puts the customer's own name in front of ccsend.com.
 */
const VENDOR_DOMAINS = [
  'ccsend.com',
  'amazonses.com',
  'sendgrid.net',
  'mailchimp.com',
  'mcsv.net',
  'rsgsv.net',
  'sparkpostmail.com',
  'mandrillapp.com',
]

/**
 * Robots whose mail is still the business record of something.
 *
 * Calendly sends from notifications@calendly.com, which every pattern above
 * says to hide — and those "New Event" emails are the ONLY place a booked
 * call appears in the CRM: calendly_events is empty, so the webhook that was
 * meant to carry bookings is delivering nothing. Hiding them would have taken
 * away the team's one sight of a booking to tidy up an inbox.
 */
const VENDOR_EXCEPT_DOMAINS = ['calendly.com']

/** Is this address a robot whose mail nobody needs to see? */
export function isVendorAddress(email: string | null | undefined): boolean {
  const address = (email ?? '').trim().toLowerCase()
  const at = address.lastIndexOf('@')
  if (at < 1) return false
  const local = address.slice(0, at)
  const domain = address.slice(at + 1)

  const matches = (list: string[]) =>
    list.some((d) => domain === d || domain.endsWith(`.${d}`))

  if (matches(VENDOR_EXCEPT_DOMAINS)) return false
  if (VENDOR_LOCAL_PART.test(local)) return true
  return matches(VENDOR_DOMAINS)
}

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

  // AFTER the contact lookup, never before. If someone is in contacts under an
  // address that looks automated, they are still a person we are talking to —
  // the match wins and they stay visible.
  if (isVendorAddress(address)) return { kind: 'vendor', contactId: null }

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
  // Below the contact checks on purpose: a thread that holds a real contact is
  // never filed as a robot, whatever else landed in it.
  if (kinds.some((k) => k === 'vendor')) return 'vendor'
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
export const HIDDEN_CATEGORIES: SenderKind[] = ['internal', 'vendor']

/**
 * Who a conversation is with, as a filter across the mixed folders.
 *
 * The Inbox is everything that arrived, which means GoDaddy security alerts
 * and booking confirmations sit between a parent's reply and a player's
 * question. "CRM contacts" is the default because that is what this mailbox
 * is for; the other two are there for the times you are looking for the
 * booking confirmation on purpose.
 */
export type MailAudience = 'crm' | 'unmatched' | 'all'

export const AUDIENCE_CATEGORIES: Record<Exclude<MailAudience, 'all'>, SenderKind[]> = {
  crm: ['player', 'parent', 'secondary'],
  unmatched: ['unknown', 'external'],
}

/** Folders that already answer the question, so the filter would be noise. */
export const AUDIENCE_FIXED: Partial<Record<MailFolder, MailAudience>> = {
  unmatched: 'unmatched',
  matched: 'crm',
}

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
    case 'unknown': return 'Mismatched'
    default: return null
  }
}
