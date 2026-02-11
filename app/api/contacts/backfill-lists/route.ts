import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const CHUNK_SIZE = 200

export async function POST() {
  try {
    const admin = getSupabaseAdmin()

    // Find the "All Contacts Everyone" list (case-insensitive)
    let { data: list } = await admin
      .from('lists')
      .select('id, name')
      .ilike('name', '%all contacts%everyone%')
      .limit(1)
      .single()

    // Create it if it doesn't exist
    if (!list) {
      const { data: newList, error: createErr } = await admin
        .from('lists')
        .insert({ name: 'All Contacts Everyone', description: 'Master list of all contacts', sport: 'football' })
        .select('id, name')
        .single()

      if (createErr) throw createErr
      list = newList
    }

    if (!list) {
      return NextResponse.json({ error: 'Could not find or create list' }, { status: 500 })
    }

    // Get ALL contact IDs
    const { data: allContacts, error: fetchErr } = await admin
      .from('contacts')
      .select('id')

    if (fetchErr) throw fetchErr
    if (!allContacts || allContacts.length === 0) {
      return NextResponse.json({ message: 'No contacts found', added: 0 })
    }

    const allContactIds = allContacts.map((c) => c.id)

    // Find which are already in any list (not just this one)
    const inAnyList = new Set<string>()
    for (let i = 0; i < allContactIds.length; i += CHUNK_SIZE) {
      const chunk = allContactIds.slice(i, i + CHUNK_SIZE)
      const { data: existing } = await admin
        .from('contact_lists')
        .select('contact_id')
        .in('contact_id', chunk)

      existing?.forEach((e) => inAnyList.add(e.contact_id))
    }

    const notInAnyList = allContactIds.filter((id) => !inAnyList.has(id))

    if (notInAnyList.length === 0) {
      return NextResponse.json({
        message: 'All contacts are already in at least one list',
        added: 0,
        listName: list.name,
        totalContacts: allContacts.length,
        inAnyList: inAnyList.size,
      })
    }

    // Add contacts not in any list to "All Contacts Everyone"
    let added = 0
    for (let i = 0; i < notInAnyList.length; i += CHUNK_SIZE) {
      const batch = notInAnyList.slice(i, i + CHUNK_SIZE)
      const { error: insertErr } = await admin
        .from('contact_lists')
        .upsert(
          batch.map((contactId) => ({ list_id: list!.id, contact_id: contactId })),
          { onConflict: 'contact_id,list_id' }
        )
      if (insertErr) throw insertErr
      added += batch.length
    }

    return NextResponse.json({
      message: `Added ${added} contacts to "${list.name}" list`,
      added,
      listName: list.name,
      totalContacts: allContacts.length,
      alreadyInAnyList: inAnyList.size,
      notInAnyList: notInAnyList.length,
    })
  } catch (error) {
    console.error('Backfill lists error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
