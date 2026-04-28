import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PortalShell } from '@/components/portal/PortalShell'
import { Toaster } from '@/components/ui/toaster'

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/portal/login')
  }

  // Get profile with contact link. Guardians have contact_id NULL and
  // guardian_for_contact_id pointing at the player; resolve to the player's
  // contact so the portal renders their data identically.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, contact_id, guardian_for_contact_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'player') {
    redirect('/dashboard')
  }

  const playerContactId =
    profile?.contact_id ?? profile?.guardian_for_contact_id ?? null

  // Get contact details
  let contact = null
  if (playerContactId) {
    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone')
      .eq('id', playerContactId)
      .single()
    contact = data
  }

  const playerName = contact
    ? `${contact.first_name} ${contact.last_name}`
    : profile?.full_name || user.email || 'Player'

  return (
    <PortalShell playerName={playerName}>
      {children}
      <Toaster />
    </PortalShell>
  )
}
