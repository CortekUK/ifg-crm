'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, Bell, Settings, LogOut } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/(auth)/login/actions'

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
  '/sms-replies': 'SMS REPLIES',
  '/email-replies': 'EMAIL REPLIES',
  '/campaigns': 'CAMPAIGNS',
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
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b-2 border-blue-600 bg-white px-6">
      {/* Page Title - Oswald font, bold */}
      <h1 className="font-oswald text-2xl font-bold uppercase text-gray-900">
        {title}
      </h1>

      {/* Right Side Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search..."
            className="pl-9 pr-14 w-56 h-9 bg-gray-50 border-gray-200 focus:bg-white"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-gray-200 bg-gray-100 px-1.5 font-mono text-[10px] font-medium text-gray-500">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700 relative h-9 w-9">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notifications</span>
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
            3
          </span>
        </Button>

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
