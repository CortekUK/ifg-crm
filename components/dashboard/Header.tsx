'use client'

import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Settings, LogOut } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/(auth)/login/actions'
import { GlobalSearch } from './GlobalSearch'
import { NotificationsDropdown } from './NotificationsDropdown'
import { MobileSidebar } from './MobileSidebar'
import { ThemeToggle } from '@/components/ui/theme-toggle'

interface HeaderProps {
  user: {
    email: string
    full_name?: string | null
    avatar_url?: string | null
  } | null
}

// Map pathnames to page titles (uppercase)
const pageTitles: Record<string, string> = {
  '/dashboard': 'DASHBOARD',
  '/contacts': 'CONTACTS',
  '/players': 'PLAYERS',
  '/pipelines': 'PIPELINES',
  '/replies': 'REPLIES',
  '/sms-replies': 'REPLIES', // Redirect legacy route
  '/email-replies': 'REPLIES', // Redirect legacy route
  '/campaigns': 'CAMPAIGNS',
  '/lists': 'LISTS',
  '/templates': 'TEMPLATES',
  '/automations': 'AUTOMATIONS',
  '/invoices': 'INVOICES',
  '/payments': 'PAYMENTS',
  '/analytics': 'ANALYTICS',
  '/reports': 'REPORTS',
  '/users': 'USERS',
  '/settings': 'SETTINGS',
}

export function Header({ user }: HeaderProps) {
  const pathname = usePathname()
  const title = pageTitles[pathname] || 'DASHBOARD'

  const getInitials = (name: string | null | undefined, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return email.slice(0, 2).toUpperCase()
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b-2 border-blue-600 dark:border-blue-500 bg-white dark:bg-slate-900 px-4 md:px-6">
      {/* Left side - Mobile menu + Page Title */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Menu */}
        <MobileSidebar user={user} />
        
        {/* Page Title - Oswald font, bold */}
        <h1 className="font-oswald text-xl md:text-2xl font-bold uppercase text-gray-900 dark:text-white">
          {title}
        </h1>
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-2">
        {/* Global Search */}
        <GlobalSearch />

        {/* Notifications */}
        <NotificationsDropdown />

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user?.avatar_url || undefined} />
                <AvatarFallback className="bg-blue-600 text-white text-sm">
                  {getInitials(user?.full_name, user?.email || '')}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="flex items-center justify-start gap-2 p-2">
              <div className="flex flex-col space-y-0.5 leading-none">
                <p className="font-medium text-sm">{user?.full_name || 'User'}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => logout()}
              className="text-red-600 cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
