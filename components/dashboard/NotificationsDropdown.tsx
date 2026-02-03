'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  GitBranch,
  Check,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

// Notification types
type NotificationType = 'email_reply' | 'sms_reply' | 'payment' | 'new_lead' | 'deal_won' | 'deal_lost'

interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  href: string
  read: boolean
  created_at: string
}

const typeConfig: Record<NotificationType, { icon: typeof Mail; color: string; bgColor: string }> = {
  email_reply: { icon: Mail, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  sms_reply: { icon: MessageSquare, color: 'text-green-600', bgColor: 'bg-green-100' },
  payment: { icon: CreditCard, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  new_lead: { icon: UserPlus, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  deal_won: { icon: GitBranch, color: 'text-green-600', bgColor: 'bg-green-100' },
  deal_lost: { icon: X, color: 'text-red-600', bgColor: 'bg-red-100' },
}

// Mock notifications - in production, these would come from the database
const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'email_reply',
    title: 'New email reply',
    message: 'John Smith replied to your email about the UK programme',
    href: '/email-replies',
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 mins ago
  },
  {
    id: '2',
    type: 'payment',
    title: 'Payment received',
    message: '£500 deposit received from Sarah Johnson',
    href: '/payments',
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
  },
  {
    id: '3',
    type: 'new_lead',
    title: 'New lead',
    message: 'Michael Brown submitted the contact form',
    href: '/contacts',
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
  },
  {
    id: '4',
    type: 'sms_reply',
    title: 'SMS reply',
    message: 'Emma Wilson replied to your SMS',
    href: '/sms-replies',
    read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
  },
  {
    id: '5',
    type: 'deal_won',
    title: 'Deal won!',
    message: 'James Taylor signed for UCLan 2026',
    href: '/pipelines',
    read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
  },
]

export function NotificationsDropdown() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications)

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    )
    setOpen(false)
    router.push(notification.href)
  }

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const clearAll = () => {
    setNotifications([])
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
      <PopoverContent className="w-[380px] p-0" align="end">
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
          {notifications.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={markAllAsRead}
              >
                <Check className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            </div>
          )}
        </div>

        {/* Notifications List */}
        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="h-8 w-8 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No notifications yet</p>
              <p className="text-xs text-gray-400 mt-1">
                We'll notify you when something happens
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const config = typeConfig[notification.type]
                const Icon = config.icon

                return (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors flex gap-3',
                      !notification.read && 'bg-blue-50/50'
                    )}
                  >
                    <div className={cn('p-2 rounded-full shrink-0', config.bgColor)}>
                      <Icon className={cn('h-4 w-4', config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          'text-sm truncate',
                          !notification.read ? 'font-semibold' : 'font-medium'
                        )}>
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-gray-500"
              onClick={clearAll}
            >
              Clear all notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
