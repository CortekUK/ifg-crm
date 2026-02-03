'use client'

import { cn } from '@/lib/utils'
import { useSidebar } from '@/components/providers/SidebarProvider'

interface MainContentProps {
  children: React.ReactNode
}

export function MainContent({ children }: MainContentProps) {
  const { collapsed } = useSidebar()

  return (
    <div
      className={cn(
        'transition-all duration-300',
        collapsed ? 'md:pl-16' : 'md:pl-64'
      )}
    >
      {children}
    </div>
  )
}
