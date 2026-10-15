import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceClient } from '@/lib/outlook/credentials'
import { escapeLikeWildcards } from '@/lib/email/classify'

export const runtime = 'nodejs'

/**
 * Connect an unmatched address to a contact — or file it as external.
 *
 * Two things happen beyond the obvious one:
 *
 *  1. With `saveAsSecondary`, the address is recorded on the contact, so every
 *     LATER email from it matches by itself. Without that the same person
 *     writing from the same second account would land in Unmatched again
 *     tomorrow, and someone would connect it again.
 *
 *  2. Every OTHER unmatched message from the same address is connected at the
 *     same time. They are the same person by definition, and leaving the rest
 *     behind would mean connecting an address once per email rather than once.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin', 'recruiter'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 })
  }

  let body: {
    email?: string
    contactId?: string
    saveAsSecondary?: boolean
    markExternal?: boolean
    threadId?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'No address given.' }, { status: 400 })

  // ilike treats _ and % as wildcards, and underscores are ordinary in email
  // addresses. Unescaped, connecting john_smith@gmail.com also re-attributes
  // mail from johnXsmith@gmail.com — onto a player they have nothing to do
  // with. Same helper the send route already uses.
  const pattern = escapeLikeWildcards(email)

  const service = getServiceClient()
  if (!service) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

  // ── "not a contact" ────────────────────────────────────────────────────
  // Filed as external rather than left unknown, so it stops appearing in the
  // queue of things waiting for a human.
  if (body.markExternal) {
    await service.from('email_replies')
      .update({ sender_kind: 'external' })
      .ilike('from_email', pattern)
    await service.from('email_threads')
      .update({ category: 'external' })
      .ilike('counterparty_email', pattern)
    // The caller needs the new state to update the screen without a reload.
    return NextResponse.json({
      success: true, markedExternal: true, email, category: 'external', contactId: null,
    })
  }

  if (!body.contactId) return NextResponse.json({ error: 'No contact chosen.' }, { status: 400 })

  const { data: contact } = await service
    .from('contacts').select('id, first_name, last_name').eq('id', body.contactId).maybeSingle()
  if (!contact) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 })

  if (body.saveAsSecondary) {
    const { error } = await service.from('contact_emails').insert({
      contact_id: body.contactId,
      email,
      kind: 'secondary',
      added_by_id: user.id,
    })
    // 23505 = the address is already recorded. Connecting it again is not an
    // error, so the rest of the work carries on.
    if (error && (error as { code?: string }).code !== '23505') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // The contact's live deal, so the connected messages land on the right card.
  const { data: deal } = await service
    .from('deals')
    .select('id, pipeline_id')
    .eq('contact_id', body.contactId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: updated, error: updateError } = await service
    .from('email_replies')
    .update({
      contact_id: body.contactId,
      deal_id: (deal as { id: string } | null)?.id ?? null,
      pipeline_id: (deal as { pipeline_id: string } | null)?.pipeline_id ?? null,
      match_status: 'manually_matched',
      matched_by_id: user.id,
      matched_at: new Date().toISOString(),
      sender_kind: body.saveAsSecondary ? 'secondary' : 'player',
    })
    .ilike('from_email', pattern)
    .select('id')

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  await service
    .from('email_threads')
    .update({
      contact_id: body.contactId,
      deal_id: (deal as { id: string } | null)?.id ?? null,
      pipeline_id: (deal as { pipeline_id: string } | null)?.pipeline_id ?? null,
      is_crm_related: true,
      category: body.saveAsSecondary ? 'secondary' : 'player',
    })
    .ilike('counterparty_email', pattern)

  const name = `${(contact as { first_name: string | null }).first_name ?? ''} ${(contact as { last_name: string | null }).last_name ?? ''}`.trim()

  // Linking a stranger to a contact is the moment they become a lead, and
  // putting a lead in a pipeline is the next thing anyone does. The screen
  // can only offer that if it knows whether they are already in one.
  const { count: dealCount } = await service
    .from('deals')
    .select('id', { count: 'exact', head: true })
    .eq('contact_id', body.contactId)

  return NextResponse.json({
    success: true,
    contactName: name,
    contactId: body.contactId,
    email,
    // So the open conversation can flip from "Unmatched sender" to the matched
    // contact banner immediately, rather than waiting for a refetch — or, as
    // it was, a manual page refresh.
    category: body.saveAsSecondary ? 'secondary' : 'player',
    messagesConnected: (updated ?? []).length,
    savedAsSecondary: !!body.saveAsSecondary,
    hasDeal: (dealCount ?? 0) > 0,
  })
}
