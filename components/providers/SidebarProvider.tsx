'use client'

import * as React from 'react'

interface SidebarContextType {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  toggleCollapsed: () => void
}

const SidebarContext = React.createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false)

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((prev) => !prev)
  }, [])

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, toggleCollapsed }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}
