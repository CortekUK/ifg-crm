'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PortalHeader } from './PortalHeader'
import { PortalSidebar } from './PortalSidebar'
import { PortalBottomNav } from './PortalBottomNav'

interface PortalShellProps {
  playerName: string
  displayName: string
  isGuardian: boolean
  children: React.ReactNode
}

export function PortalShell({
  playerName,
  displayName,
  isGuardian,
  children,
}: PortalShellProps) {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/portal/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Desktop Sidebar */}
      <PortalSidebar onLogout={handleLogout} />

      {/* Main Content */}
      <div className="md:pl-64">
        <PortalHeader
          playerName={playerName}
          displayName={displayName}
          isGuardian={isGuardian}
          onLogout={handleLogout}
        />
        <main className="p-4 md:p-6 pb-24 md:pb-6">{children}</main>
      </div>

      {/* Mobile Bottom Nav */}
      <PortalBottomNav />
    </div>
  )
}
