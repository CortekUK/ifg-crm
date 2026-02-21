'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  LayoutDashboard,
  Users,
  GitBranch,
  MessageSquare,
  Mail,
  Send,
  FileText,
  Zap,
  ReceiptPoundSterling,
  CreditCard,
  BarChart3,
  FileBarChart,
  UserCog,
  Settings,
  LogOut,
  Menu,
  ListIcon,
} from 'lucide-react'
import { logout } from '@/app/(auth)/login/actions'

interface MobileSidebarProps {
  user: {
    email: string
    full_name?: string | null
    avatar_url?: string | null
    role?: string
  } | null
}

const navSections = [
  {
    label: 'CRM',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/contacts', label: 'Contacts', icon: Users },
      { href: '/pipelines', label: 'Pipelines', icon: GitBranch },
      { href: '/replies', label: 'Replies', icon: MessageSquare },
    ],
  },
  {
    label: 'MARKETING',
    adminOnly: true,
    items: [
      { href: '/campaigns', label: 'Campaigns', icon: Send },
      { href: '/lists', label: 'Lists', icon: ListIcon },
      { href: '/templates', label: 'Templates', icon: FileText },
    ],
  },
  {
    label: 'AUTOMATION',
    items: [
      { href: '/automations', label: 'Automations', icon: Zap },
    ],
  },
  {
    label: 'FINANCE',
    adminOnly: true,
    items: [
      { href: '/invoices', label: 'Invoices', icon: ReceiptPoundSterling },
      { href: '/payments', label: 'Payments', icon: CreditCard },
    ],
  },
  {
    label: 'INSIGHTS',
    adminOnly: true,
    items: [
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/reports', label: 'Reports', icon: FileBarChart },
    ],
  },
  {
    label: 'ADMIN',
    adminOnly: true,
    items: [
      { href: '/users', label: 'Users', icon: UserCog },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export function MobileSidebar({ user }: MobileSidebarProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const visibleSections = navSections.filter(
    (section) => !section.adminOnly || isAdmin
  )

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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-9 w-9"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 p-0 text-white sidebar-gradient"
      >
        <SheetHeader className="px-4 py-4 border-b border-white/10">
          <SheetTitle className="text-left flex items-center gap-3">
            <svg 
              className="h-7 w-7 shrink-0" 
              viewBox="0 0 24 24" 
              fill="white"
            >
              <path 
                fillRule="evenodd" 
                clipRule="evenodd" 
                d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
              />
            </svg>
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] font-medium text-white/70">THE INTERNATIONAL</span>
              <span className="text-base font-extrabold text-white">FOOTBALL GROUP</span>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-5 max-h-[calc(100vh-180px)]">
          {visibleSections.map((section) => (
            <div key={section.label}>
              <h3 className="text-[10px] font-semibold text-white/50 uppercase mb-2 px-3">
                {section.label}
              </h3>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href
                  const Icon = item.icon
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'text-white/70 hover:bg-white/10 hover:text-white'
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User Menu */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-white/10 sidebar-gradient">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={user?.avatar_url || undefined} />
              <AvatarFallback className="bg-white/20 text-white text-xs">
                {getInitials(user?.full_name, user?.email || '')}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-medium text-white truncate">
                {user?.full_name || 'User'}
              </span>
              <span className="text-xs text-white/60 truncate">
                {user?.email}
              </span>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-white/70 hover:text-white hover:bg-white/10"
              asChild
            >
              <Link href="/settings" onClick={() => setOpen(false)}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-300 hover:text-red-200 hover:bg-red-500/20"
              onClick={() => logout()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
