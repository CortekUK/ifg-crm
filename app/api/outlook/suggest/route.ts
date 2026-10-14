import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { suggestContacts } from '@/lib/outlook/suggest-contacts'

export const runtime = 'nodejs'

/**
 * Ranked contact suggestions for an unmatched sender.
 *
 * Runs server-side because the ranking fans out across several calls to the
 * ranked contact search; doing that from the browser on every dialog open
 * would be several round trips over the wire instead of one.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const email = request.nextUrl.searchParams.get('email')
  const name = request.nextUrl.searchParams.get('name')
  if (!email) return NextResponse.json({ error: 'No address given.' }, { status: 400 })

  const suggestions = await suggestContacts(supabase, name, email, 5)

  // Each suggestion carries the contact's live deals, so the dialog can show
  // what connecting would attach the history to.
  const ids = suggestions.map((s) => s.contactId)
  if (ids.length) {
    const { data: deals } = await supabase
      .from('deals')
      .select('contact_id, pipeline:pipelines(name), stage:pipeline_stages!deals_current_stage_id_fkey(name)')
      .in('contact_id', ids)
      .eq('status', 'active')

    const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v)
    for (const s of suggestions) {
      s.deals = (deals ?? [])
        .filter((d) => (d as { contact_id: string }).contact_id === s.contactId)
        .map((d) => {
          const row = d as unknown as {
            pipeline: { name: string } | { name: string }[] | null
            stage: { name: string } | { name: string }[] | null
          }
          return { pipeline: one(row.pipeline)?.name ?? null, stage: one(row.stage)?.name ?? null }
        })
    }
  }

  return NextResponse.json({ suggestions })
}
