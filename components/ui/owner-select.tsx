'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useUsers } from '@/lib/hooks/useUsers'

interface OwnerSelectProps {
  value: string | null | undefined
  onChange: (value: string | null) => void
  placeholder?: string
  disabled?: boolean
  allowClear?: boolean
  className?: string
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '??'
  const parts = name.split(' ')
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
}

function getAvatarColor(name: string | null | undefined): string {
  const colors = [
    'bg-blue-600',
    'bg-green-600',
    'bg-purple-600',
    'bg-orange-600',
    'bg-pink-600',
    'bg-teal-600',
    'bg-indigo-600',
    'bg-red-600',
  ]
  const str = name || ''
  const hash = str.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

export function OwnerSelect({
  value,
  onChange,
  placeholder = 'Select owner',
  disabled = false,
  allowClear = false,
  className,
}: OwnerSelectProps) {
  const { data: users = [], isLoading } = useUsers()

  // Filter to only active users who can be assigned
  const activeUsers = users.filter((u) => u.is_active)

  if (isLoading) {
    return <Skeleton className={`h-10 w-full ${className}`} />
  }

  return (
    <Select
      value={value || undefined}
      onValueChange={(val) => onChange(val === '__clear__' ? null : val)}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {value && activeUsers.find((u) => u.id === value) && (
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarFallback
                  className={`${getAvatarColor(
                    activeUsers.find((u) => u.id === value)?.full_name
                  )} text-white text-[10px]`}
                >
                  {getInitials(activeUsers.find((u) => u.id === value)?.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">
                {activeUsers.find((u) => u.id === value)?.full_name ||
                  activeUsers.find((u) => u.id === value)?.email}
              </span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowClear && (
          <SelectItem value="__clear__" className="text-muted-foreground">
            No owner
          </SelectItem>
        )}
        {activeUsers.map((user) => (
          <SelectItem key={user.id} value={user.id}>
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback
                  className={`${getAvatarColor(user.full_name)} text-white text-xs`}
                >
                  {getInitials(user.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium">
                  {user.full_name || 'Unnamed User'}
                </span>
                <span className="text-xs text-muted-foreground">{user.email}</span>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
