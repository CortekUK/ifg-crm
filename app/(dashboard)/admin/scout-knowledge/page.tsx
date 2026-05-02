// Super_admin-only knowledge-base editor for Scout.
//
// Lists articles, creates/edits/deletes via the /api/scout/knowledge routes.
// Server-renders the role gate so non-super_admins get a 404-ish message
// instead of the editor flashing into view, then hands the data off to the
// client component for the interactive bits.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ScoutKnowledgeEditor } from '@/components/scout/admin/ScoutKnowledgeEditor'

export const dynamic = 'force-dynamic'

export default async function ScoutKnowledgePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
          Super-admin only
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          The Scout knowledge base is restricted to super_admin users.
        </p>
      </div>
    )
  }

  return <ScoutKnowledgeEditor />
}
