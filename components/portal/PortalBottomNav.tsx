'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ReceiptPoundSterling, BarChart3, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/portal', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/portal/invoices', label: 'Invoices', icon: ReceiptPoundSterling },
  { href: '/portal/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/portal/settings', label: 'Settings', icon: Settings },
]

export function PortalBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t bg-white dark:bg-slate-900 dark:border-slate-800 safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href)
          const Icon = tab.icon

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors',
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
