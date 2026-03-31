'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Moon, Sun, Search, X, ReceiptPoundSterling, CreditCard, Info } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/lib/hooks/useNotifications'
import { formatDistanceToNow } from 'date-fns'

interface PortalHeaderProps {
  playerName: string
}

const searchRoutes = [
  { label: 'Dashboard', href: '/portal', keywords: ['home', 'overview', 'dashboard'] },
  { label: 'Invoices', href: '/portal/invoices', icon: ReceiptPoundSterling, keywords: ['invoice', 'payment', 'pay', 'bill', 'money'] },
  { label: 'Analytics', href: '/portal/analytics', keywords: ['analytics', 'stats', 'statistics', 'chart'] },
  { label: 'Settings', href: '/portal/settings', keywords: ['settings', 'profile', 'password', 'theme'] },
]

export function PortalHeader({ playerName }: PortalHeaderProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: notifData } = useNotifications(20)
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const notifications = notifData?.notifications || []
  const unreadCount = notifData?.unreadCount || 0

  const initials = playerName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Cmd+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  const filteredRoutes = searchQuery.trim()
    ? searchRoutes.filter((r) =>
        r.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.keywords.some((k) => k.includes(searchQuery.toLowerCase()))
      )
    : searchRoutes

  const handleSelect = (href: string) => {
    setSearchOpen(false)
    setSearchQuery('')
    router.push(href)
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between h-14 md:h-16 px-4 md:px-6 bg-white dark:bg-slate-900 border-b dark:border-slate-800">
        {/* Left: Logo (mobile only) + Title */}
        <div className="flex items-center gap-2">
          <div className="md:hidden flex items-center gap-2">
            <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="currentColor">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
              />
            </svg>
            <span className="font-bold text-sm text-slate-900 dark:text-white">IFG</span>
          </div>
          <h1 className="hidden md:block font-oswald text-xl font-bold uppercase text-slate-900 dark:text-white">
            Player Portal
          </h1>
        </div>

        {/* Center: Search Bar (desktop) */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Search className="h-4 w-4" />
            <span>Search...</span>
            <kbd className="ml-auto text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right: Search (mobile) + Theme + Notifications + Avatar */}
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" className="md:hidden h-9 w-9" onClick={() => setSearchOpen(true)}>
            <Search className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="icon" className="relative h-9 w-9" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          <Popover open={notifOpen} onOpenChange={setNotifOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-4 min-w-4 p-0 flex items-center justify-center text-[10px] bg-red-500 text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => markAllRead.mutate()}>
                    Mark all read
                  </Button>
                )}
              </div>
              <ScrollArea className="max-h-72">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center">
                    <Bell className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm text-slate-400">No notifications</p>
                  </div>
                ) : (
                  <div className="divide-y dark:divide-slate-800">
                    {notifications.map((n) => {
                      const Icon = n.type === 'payment' ? CreditCard : Info
                      return (
                        <button
                          key={n.id}
                          className={cn(
                            'w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
                            !n.is_read && 'bg-blue-50/50 dark:bg-blue-950/20'
                          )}
                          onClick={() => {
                            if (!n.is_read) markRead.mutate(n.id)
                            if (n.href) router.push(n.href)
                            setNotifOpen(false)
                          }}
                        >
                          <div className={cn(
                            'p-1.5 rounded-lg shrink-0 mt-0.5',
                            n.type === 'payment' ? 'bg-green-100 dark:bg-green-900/50 text-green-600' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-600'
                          )}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{n.title}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          {!n.is_read && (
                            <div className="w-2 h-2 bg-blue-600 rounded-full shrink-0 mt-2" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-blue-600 text-white text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Search Overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setSearchOpen(false)}>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg mx-4 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border dark:border-slate-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 border-b dark:border-slate-800">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <Input
                ref={inputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pages..."
                className="border-0 shadow-none focus-visible:ring-0 h-12 text-base"
              />
              {searchQuery && (
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSearchQuery('')}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {filteredRoutes.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No results found</p>
              ) : (
                filteredRoutes.map((route) => (
                  <button
                    key={route.href}
                    onClick={() => handleSelect(route.href)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {route.icon ? (
                      <route.icon className="h-4 w-4 text-slate-400 shrink-0" />
                    ) : (
                      <Search className="h-4 w-4 text-slate-400 shrink-0" />
                    )}
                    <span className="text-sm font-medium text-slate-900 dark:text-white">{route.label}</span>
                  </button>
                ))
              )}
            </div>
            <div className="px-4 py-2 border-t dark:border-slate-800 flex items-center gap-4 text-[10px] text-slate-400">
              <span><kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">↵</kbd> to select</span>
              <span><kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">esc</kbd> to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
