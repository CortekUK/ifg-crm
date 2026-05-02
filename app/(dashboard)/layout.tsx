import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { Header } from '@/components/dashboard/Header'
import { MainContent } from '@/components/dashboard/MainContent'
import { SidebarProvider } from '@/components/providers/SidebarProvider'
import { Toaster } from '@/components/ui/toaster'
import { KeyboardShortcutsProvider } from '@/components/providers/KeyboardShortcutsProvider'
// Scout's floating widget retired in favour of a dedicated /scout page
// (Claude-style standalone window). Sidebar nav links to it with target
// _blank. Component file kept in case we want to revert.
// import { ScoutWidget } from '@/components/scout/ScoutWidget'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  // Get the current user
  const { data: { user } } = await supabase.auth.getUser()
  
  // Get the user's profile
  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, role')
      .eq('id', user.id)
      .single()
    profile = data
  }

  const userData = user ? {
    email: user.email || '',
    full_name: profile?.full_name || user.user_metadata?.full_name || null,
    avatar_url: profile?.avatar_url || null,
    role: profile?.role || 'recruiter',
  } : null

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
        {/* Desktop Sidebar - Hidden on mobile */}
        <div className="hidden md:block">
          <Sidebar user={userData} />
        </div>
        
        {/* Main Content - Responsive to sidebar width */}
        <MainContent>
          <Header user={userData} />
          <main className="p-4 md:p-6">
            {children}
          </main>
        </MainContent>

        {/* Keyboard Shortcuts */}
        <KeyboardShortcutsProvider>
          <></>
        </KeyboardShortcutsProvider>

        {/* Toast Notifications */}
        <Toaster />
      </div>
    </SidebarProvider>
  )
}
