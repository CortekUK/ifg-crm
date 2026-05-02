// Standalone layout for the dedicated Scout page. Lives OUTSIDE the
// (dashboard) group so the user gets a clean full-window experience —
// no IFG sidebar, no dashboard header, just Scout. Mirrors how Claude
// renders its full-screen chat at claude.ai.
//
// We still pull in the global providers (theme + react-query) via the
// root layout that wraps this one, so dark mode and live data hooks
// keep working.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Scout — IFG CRM',
}

export default async function ScoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Server-side gate. Anyone not authenticated bounces to /login; anyone
  // who isn't a super_admin gets redirected back to the dashboard.
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
    redirect('/dashboard')
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {children}
    </div>
  )
}
