'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ReceiptPoundSterling,
  GitBranch,
  Send,
  BarChart3,
  Settings,
  LogOut,
  MapPin,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface PortalSidebarProps {
  onLogout: () => void
}

const navItems = [
  { href: '/portal', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/portal/invoices', label: 'Invoices', icon: ReceiptPoundSterling },
  { href: '/portal/pipeline', label: 'Pipeline', icon: GitBranch },
  { href: '/portal/campaigns', label: 'Campaigns', icon: Send },
  { href: '/portal/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/portal/settings', label: 'Settings', icon: Settings },
]

export function PortalSidebar({ onLogout }: PortalSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex fixed left-0 top-0 z-40 h-screen w-64 flex-col sidebar-gradient text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 h-16 px-4 border-b border-white/10">
        <svg className="h-7 w-7 shrink-0" viewBox="0 0 24 24" fill="white">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
          />
        </svg>
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] font-medium text-white/70">PLAYER PORTAL</span>
          <span className="text-sm font-extrabold text-white">IFG</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-hide">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
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
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-white/10">
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Log out
        </Button>
      </div>
    </aside>
  )
}
