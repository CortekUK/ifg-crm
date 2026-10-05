import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Gate an API route to admins. Returns a 401/403 response to send back, or
 * null when the caller is an admin or super admin.
 *
 * API routes are skipped by the middleware's admin-path check, so any route
 * that hands out data the screen only shows admins, or that runs with the
 * service-role key, has to check the role itself.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Only an admin can do this.' }, { status: 403 })
  }
  return null
}
