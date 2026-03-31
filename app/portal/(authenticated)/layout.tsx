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

  // Get profile with contact link
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, contact_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'player') {
    redirect('/dashboard')
  }

  // Get contact details
  let contact = null
  if (profile?.contact_id) {
    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone')
      .eq('id', profile.contact_id)
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
