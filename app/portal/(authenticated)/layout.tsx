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

  // Guardian = the auth user is linked to the player's contact via the
  // guardian_for_contact_id column rather than owning contact_id directly.
  const isGuardian = !!profile?.guardian_for_contact_id
  const playerContactId =
    profile?.contact_id ?? profile?.guardian_for_contact_id ?? null

  // Get contact details (always the player's contact — guardian sees the
  // player's data, but we also pull parent_name to display the guardian's
  // own name when isGuardian.
  let contact: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
    parent_name: string | null
  } | null = null
  if (playerContactId) {
    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone, parent_name')
      .eq('id', playerContactId)
      .single()
    contact = data
  }

  const playerName = contact
    ? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || 'Player'
    : profile?.full_name || user.email || 'Player'

  // For a guardian, the displayed name is the parent's name; the portal still
  // shows the player's data, but the avatar/header reflects who is logged in.
  const displayName = isGuardian
    ? contact?.parent_name || profile?.full_name || user.email || 'Guardian'
    : playerName

  return (
    <PortalShell
      playerName={playerName}
      displayName={displayName}
      isGuardian={isGuardian}
    >
      {children}
      <Toaster />
    </PortalShell>
  )
}
