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
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Eye, Pencil, Trash2, Users, ListIcon } from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import type { List } from '@/lib/types/lists'

interface ListsTableProps {
  lists: List[]
  isLoading: boolean
  onView: (list: List) => void
  onEdit: (list: List) => void
  onDelete: (list: List) => void
}

export function ListsTable({
  lists,
  isLoading,
  onView,
  onEdit,
  onDelete,
}: ListsTableProps) {
  if (isLoading) {
    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Contacts</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                <TableCell><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
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

  if (lists.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center">
        <ListIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No lists yet</h3>
        <p className="text-muted-foreground">
          Create your first list to organise your contacts.
        </p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Contacts</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lists.map((list) => (
            <TableRow
              key={list.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onView(list)}
            >
              {/* Name */}
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="font-medium text-gray-900">{list.name}</span>
                </div>
              </TableCell>

              {/* Description */}
              <TableCell className="text-muted-foreground max-w-xs truncate">
                {list.description || '—'}
              </TableCell>

              {/* Contacts Count */}
              <TableCell className="text-right">
                <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                  {list.contact_count?.toLocaleString() || 0}
                </Badge>
              </TableCell>

              {/* Type */}
              <TableCell>
                <Badge
                  variant="outline"
                  className={
                    list.is_dynamic
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }
                >
                  {list.is_dynamic ? 'Dynamic' : 'Static'}
                </Badge>
              </TableCell>

              {/* Created */}
              <TableCell className="text-muted-foreground">
                {formatDate(list.created_at)}
              </TableCell>

              {/* Actions */}
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onView(list)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Contacts
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(list)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(list)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
