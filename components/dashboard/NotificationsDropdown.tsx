'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Bell,
  Mail,
  MessageSquare,
  CreditCard,
  UserPlus,
  Trophy,
  XCircle,
  GitBranch,
  FileText,
  Check,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useClearAllNotifications,
} from '@/lib/hooks/useNotifications'
import type { Notification } from '@/lib/hooks/useNotifications'

const typeConfig: Record<Notification['type'], { icon: typeof Mail; color: string; bgColor: string }> = {
  email_reply: { icon: Mail, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/50' },
  sms_reply: { icon: MessageSquare, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/50' },
  payment: { icon: CreditCard, color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/50' },
  new_lead: { icon: UserPlus, color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/50' },
  deal_won: { icon: Trophy, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/50' },
  deal_lost: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/50' },
  deal_stage: { icon: GitBranch, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/50' },
  form_submission: { icon: FileText, color: 'text-indigo-600', bgColor: 'bg-indigo-100 dark:bg-indigo-900/50' },
  general: { icon: Info, color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-800' },
}

export function NotificationsDropdown() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const { data, isLoading } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const clearAll = useClearAllNotifications()

  const notifications = data?.notifications || []
  const unreadCount = data?.unreadCount || 0

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markRead.mutate(notification.id)
    }
    setOpen(false)
    if (notification.href) {
      router.push(notification.href)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-gray-500 hover:text-gray-700 dark:text-gray-300 relative h-9 w-9"
        >
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notifications</span>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0 max-h-[70vh] flex flex-col" align="end">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="h-8 w-8 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No notifications yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                We&apos;ll notify you when something happens
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.map((notification) => {
                const config = typeConfig[notification.type] || typeConfig.general
                const Icon = config.icon

                return (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors flex gap-3',
                      !notification.is_read && 'bg-blue-50/50 dark:bg-blue-950/30'
                    )}
                  >
                    <div className={cn('w-9 h-9 rounded-full shrink-0 flex items-center justify-center', config.bgColor)}>
                      <Icon className={cn('h-4 w-4', config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          'text-sm truncate',
                          !notification.is_read ? 'font-semibold' : 'font-medium'
                        )}>
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-gray-500"
              onClick={() => clearAll.mutate()}
              disabled={clearAll.isPending}
            >
              {clearAll.isPending ? 'Clearing...' : 'Clear all notifications'}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
