'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  LayoutDashboard,
  Users,
  UserCheck,
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
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  MapPin,
  ListIcon,
} from 'lucide-react'
import { logout } from '@/app/(auth)/login/actions'
import { useSidebar } from '@/components/providers/SidebarProvider'

interface SidebarProps {
  user: {
    email: string
    full_name?: string | null
    avatar_url?: string | null
  } | null
}

const navSections = [
  {
    label: 'CRM',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/contacts', label: 'Contacts', icon: Users },
      { href: '/players', label: 'Players', icon: UserCheck },
      { href: '/pipelines', label: 'Pipelines', icon: GitBranch },
      { href: '/sms-replies', label: 'SMS Replies', icon: MessageSquare },
      { href: '/email-replies', label: 'Email Replies', icon: Mail },
    ],
  },
  {
    label: 'MARKETING',
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
    items: [
      { href: '/invoices', label: 'Invoices', icon: ReceiptPoundSterling },
      { href: '/payments', label: 'Payments', icon: CreditCard },
    ],
  },
  {
    label: 'INSIGHTS',
    items: [
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/reports', label: 'Reports', icon: FileBarChart },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { href: '/users', label: 'Users', icon: UserCog },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const { collapsed, toggleCollapsed } = useSidebar()

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
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen text-white flex flex-col transition-all duration-300 sidebar-gradient',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo - matches header height (h-16 = 64px) */}
      <div className={cn(
        'flex items-center gap-3 h-16 px-4 border-b border-white/10',
        collapsed ? 'justify-center' : ''
      )}>
        {/* Custom pin marker SVG with hole visible */}
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
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-medium text-white/70">THE INTERNATIONAL</span>
            <span className="text-base font-extrabold text-white">FOOTBALL GROUP</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        {navSections.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <h3 className="text-[10px] font-semibold text-white/50 uppercase mb-2 px-3">
                {section.label}
              </h3>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'text-white/70 hover:bg-white/10 hover:text-white',
                        collapsed && 'justify-center px-2'
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {!collapsed && item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse Button */}
      <div className="px-3 py-2 border-t border-white/10">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleCollapsed}
          className={cn(
            'w-full text-white/70 hover:text-white hover:bg-white/10',
            collapsed ? 'justify-center px-2' : 'justify-start'
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Collapse
            </>
          )}
        </Button>
      </div>

      {/* User Menu */}
      <div className="p-3 border-t border-white/10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                'w-full gap-3 h-auto hover:bg-white/10',
                collapsed ? 'justify-center px-2 py-2' : 'justify-start px-3 py-3'
              )}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={user?.avatar_url || undefined} />
                <AvatarFallback className="bg-white/20 text-white text-xs">
                  {getInitials(user?.full_name, user?.email || '')}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex flex-col items-start text-left flex-1 min-w-0">
                    <span className="text-sm font-medium text-white truncate w-full">
                      {user?.full_name || 'User'}
                    </span>
                    <span className="text-xs text-white/60 truncate w-full">
                      {user?.email}
                    </span>
                  </div>
                  <ChevronUp className="h-4 w-4 text-white/60 shrink-0" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align={collapsed ? 'center' : 'start'}
            className="w-56"
          >
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
    </aside>
  )
}
