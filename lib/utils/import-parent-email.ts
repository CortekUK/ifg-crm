/**
 * Parent email as the contact email, for rows that have no email of their own.
 *
 * A player with no email but a parent email used to be dropped from an import
 * entirely. IFG already reaches 1,260 players through a parent's address, so
 * the parent email is a legitimate primary address — with one hard limit:
 * contacts.email is UNIQUE, one address per contact.
 *
 * That limit is not ours to relax lightly. The deposit route, website forms,
 * inbound replies and several webhooks all find a person by email alone; two
 * contacts on one address would make a parent with two children unable to pay
 * a deposit (maybeSingle() errors on two matches) and make every form
 * submission create a fresh duplicate. So an address is only handed to a row
 * when nobody else has a claim on it:
 *
 *   - another row in the file already uses it as its OWN email  -> clash
 *   - it belongs to a differently-named contact in the CRM       -> clash
 *   - an earlier row in the file already took it, different name -> clash
 *     (siblings)
 *
 * The SAME name is treated as the same person — a repeated row, or a player
 * imported by an earlier run — so running the file twice stays safe.
 *
 * A clash is never resolved silently. The row is skipped with a reason that
 * names who holds the address, so someone can add that player by hand.
 */

import { buildContactFromRow } from '@/lib/utils/csv'

/** Who already holds an address in the CRM, keyed by lowercased email. */
export type EmailOwners = Map<string, { first_name: string | null; last_name: string | null }>

export interface ParentEmailResult {
  /** Same length and order as the input; the email cell filled where used. */
  rows: string[][]
  /** Row indexes that took their parent's email. */
  fromParent: Set<number>
  /** Row index -> why it could not take the parent email. */
  clashes: Map<number, string>
  /** Rows with no email of their own but a parent email, used or not. */
  eligible: number
}

function colFor(mapping: Record<number, string>, field: string): number | undefined {
  const hit = Object.entries(mapping).find(([, v]) => v === field)
  return hit ? Number(hit[0]) : undefined
}

function person(first: unknown, last: unknown) {
  const display = [first, last]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
    .join(' ')
  return { key: display.toLowerCase().replace(/\s+/g, ' '), display: display || 'an unnamed contact' }
}

function rowPerson(row: string[], mapping: Record<number, string>) {
  const c = buildContactFromRow(row, mapping)
  return person(c.first_name, c.last_name)
}

export function applyParentEmailFallback(
  rows: string[][],
  mapping: Record<number, string>,
  owners: EmailOwners,
  enabled: boolean,
): ParentEmailResult {
  const fromParent = new Set<number>()
  const clashes = new Map<number, string>()
  const emailCol = colFor(mapping, 'email')
  const parentCol = colFor(mapping, 'parent_email')

  if (emailCol === undefined || parentCol === undefined) {
    return { rows, fromParent, clashes, eligible: 0 }
  }

  // Addresses rows already use as their own email, first row wins.
  const ownedByRow = new Map<string, number>()
  rows.forEach((row, i) => {
    const own = row[emailCol]?.trim().toLowerCase()
    if (own && !ownedByRow.has(own)) ownedByRow.set(own, i)
  })

  const takenBy = new Map<string, { index: number; key: string; display: string }>()
  const out = rows.slice()
  let eligible = 0

  rows.forEach((row, i) => {
    if (row[emailCol]?.trim()) return
    const parent = row[parentCol]?.trim()
    if (!parent) return

    eligible++
    if (!enabled) return

    const address = parent.toLowerCase()
    const me = rowPerson(row, mapping)

    const ownerRow = ownedByRow.get(address)
    if (ownerRow !== undefined) {
      const them = rowPerson(rows[ownerRow], mapping)
      clashes.set(i, `Parent email is already ${them.display}'s own email (row ${ownerRow + 1})`)
      return
    }

    const owner = owners.get(address)
    if (owner) {
      const them = person(owner.first_name, owner.last_name)
      if (them.key !== me.key) {
        clashes.set(i, `Parent email already belongs to ${them.display} in the CRM`)
        return
      }
    }

    const earlier = takenBy.get(address)
    if (earlier && earlier.key !== me.key) {
      clashes.set(i, `Shares a parent email with ${earlier.display} (row ${earlier.index + 1})`)
      return
    }
    if (!earlier) takenBy.set(address, { index: i, key: me.key, display: me.display })

    const filled = row.slice()
    filled[emailCol] = parent
    out[i] = filled
    fromParent.add(i)
  })

  return { rows: out, fromParent, clashes, eligible }
}
