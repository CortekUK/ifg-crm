'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Pencil, UserX, ExternalLink, Users, Clock, RotateCw, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import type { User, UserRole, UserOrInvite } from '@/lib/types/users'

interface UsersTableProps {
  users: UserOrInvite[]
  isLoading: boolean
  onEdit: (user: User) => void
  onDeactivate: (user: User) => void
  onDelete: (user: User) => void
  onResendInvite?: (invite: UserOrInvite) => void
  onCancelInvite?: (invite: UserOrInvite) => void
}

const roleConfig: Record<UserRole, { label: string; className: string }> = {
  super_admin: { label: 'Super Admin', className: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700' },
  admin: { label: 'Admin', className: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700' },
  recruiter: { label: 'Recruiter', className: 'bg-green-100 dark:bg-green-900/50 text-green-700' },
}

export function UsersTable({
  users,
  isLoading,
  onEdit,
  onDeactivate,
  onDelete,
  onResendInvite,
  onCancelInvite,
}: UsersTableProps) {
  const getInitials = (name: string | null, email: string) => {
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

  if (isLoading) {
    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Sport</TableHead>
              <TableHead>Calendly</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-10 w-36" /></TableCell>
                <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center">
        <Users className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No users yet</h3>
        <p className="text-muted-foreground">
          Invite your first team member to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Sport</TableHead>
            <TableHead>Calendly</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Login</TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const role = roleConfig[user.role]
            const isPendingInvite = user.is_invite

            return (
              <TableRow key={user.id} className={isPendingInvite ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}>
                {/* User */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className={isPendingInvite ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 text-xs' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs'}>
                        {getInitials(user.full_name, user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.full_name || 'Unnamed User'}</span>
                      {isPendingInvite && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Invitation pending
                        </span>
                      )}
                    </div>
                  </div>
                </TableCell>

                {/* Email */}
                <TableCell className="text-sm text-muted-foreground">
                  {user.email}
                </TableCell>

                {/* Role */}
                <TableCell>
                  <Badge className={role.className}>{role.label}</Badge>
                </TableCell>

                {/* Sport */}
                <TableCell className="capitalize text-sm">
                  {user.sport}
                </TableCell>

                {/* Calendly */}
                <TableCell>
                  {user.calendly_url ? (
                    <a
                      href={user.calendly_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                    >
                      Link <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* Status */}
                <TableCell>
                  {isPendingInvite ? (
                    <Badge className="bg-amber-100 dark:bg-amber-900/50 text-amber-700">
                      Pending
                    </Badge>
                  ) : (
                    <Badge
                      className={
                        user.is_active
                          ? 'bg-green-100 dark:bg-green-900/50 text-green-700'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700'
                      }
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  )}
                </TableCell>

                {/* Last Login */}
                <TableCell className="text-sm text-muted-foreground">
                  {isPendingInvite
                    ? `Invited ${formatDate(user.created_at)}`
                    : user.last_login_at ? formatDate(user.last_login_at) : 'Never'
                  }
                </TableCell>

                {/* Actions */}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {isPendingInvite ? (
                        <>
                          {onResendInvite && (
                            <DropdownMenuItem onClick={() => onResendInvite(user)}>
                              <RotateCw className="h-4 w-4 mr-2" />
                              Resend Invite
                            </DropdownMenuItem>
                          )}
                          {onCancelInvite && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => onCancelInvite(user)}
                                className="text-red-600"
                              >
                                <UserX className="h-4 w-4 mr-2" />
                                Cancel Invite
                              </DropdownMenuItem>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <DropdownMenuItem onClick={() => onEdit(user as unknown as User)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDeactivate(user as unknown as User)}
                            className={user.is_active ? 'text-red-600' : ''}
                          >
                            <UserX className="h-4 w-4 mr-2" />
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDelete(user as unknown as User)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
