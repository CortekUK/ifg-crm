// Server component — fetches the super_admin's display name so the empty
// state can greet them by first name. The /scout layout has already gated
// access; here we just need the name.

import { ScoutChatPage } from '@/components/scout/ScoutChatPage'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ScoutPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let firstName = ''
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
    const fullName = (profile?.full_name ?? '').trim()
    firstName = fullName.split(/\s+/)[0] || ''
  }
  return <ScoutChatPage firstName={firstName} />
}
