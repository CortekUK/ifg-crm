/**
 * Revoke the portal logins belonging to a set of contacts.
 *
 * QA-56 Issue 2: deleting a contact left their portal login behind, linked to
 * nothing. `profiles.contact_id` is ON DELETE SET NULL, so the row survived
 * the contact with a null link — 12 such orphans exist today. The person could
 * still sign in to the portal afterwards, and because the login no longer
 * pointed at a contact, nothing in the CRM showed they had access.
 *
 * Deleting the auth user needs the service-role key, which the browser does
 * not have, so the contact-delete path calls this first. It reuses
 * deleteAccount() — the same helper behind Users → Players → Delete — so a
 * login removed this way is cleaned up identically: deactivated, removed from
 * auth, and its invite rows cleared.
 *
 * Both links are covered: the player's own login (`contact_id`) and any
 * guardian login for that player (`guardian_for_contact_id`), because a parent
 * must not keep access to a player who no longer exists.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { deleteAccount } from '@/lib/users/deletion'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  let body: { contactIds?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const contactIds = Array.isArray(body.contactIds)
    ? body.contactIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []

  if (contactIds.length === 0) return NextResponse.json({ revoked: 0 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 })
  }
  const admin = createClient(url, serviceRoleKey)

  // Only ever player and guardian logins. A staff profile has no contact link,
  // so it cannot be selected here, but the role filter makes that explicit
  // rather than relying on the data staying that way.
  const { data: logins, error } = await admin
    .from('profiles')
    .select('id, email, role, contact_id, guardian_for_contact_id')
    .eq('role', 'player')
    .or(
      `contact_id.in.(${contactIds.join(',')}),guardian_for_contact_id.in.(${contactIds.join(',')})`,
    )

  if (error) {
    console.error('revoke-portal: failed to read logins:', error.message)
    return NextResponse.json({ error: 'Could not read portal logins.' }, { status: 500 })
  }

  const failures: string[] = []
  let revoked = 0
  for (const login of logins ?? []) {
    const failure = await deleteAccount(admin, login.id as string, (login.email as string) ?? '')
    if (failure) {
      failures.push(`${login.email}: ${failure.error}`)
      continue
    }
    revoked++
  }

  // A login we could not remove must not be reported as revoked — the caller
  // decides whether to go ahead with the contact delete.
  if (failures.length > 0) {
    console.error('revoke-portal: some logins survived:', failures.join('; '))
    return NextResponse.json(
      { revoked, error: `Could not remove ${failures.length} portal login(s).` },
      { status: 500 },
    )
  }

  return NextResponse.json({ revoked })
}
