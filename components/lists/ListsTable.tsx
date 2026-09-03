'use client'

import { useMemo, useState } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Eye, Pencil, Trash2, Users, ListIcon, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { List } from '@/lib/types/lists'

type SortField = 'name' | 'contact_count' | 'created_at'
type SortDir = 'asc' | 'desc'

interface ListsTableProps {
  lists: List[]
  isLoading: boolean
  onView: (list: List) => void
  onEdit: (list: List) => void
  /** Omit to hide the Delete action — deleting lists is admin-only. */
  onDelete?: (list: List) => void
  selectedIds?: Set<string>
  onSelectedIdsChange?: (ids: Set<string>) => void
  page?: number
  pageSize?: number
}

function SortIcon({ field, activeField, dir }: { field: SortField; activeField: SortField; dir: SortDir }) {
  if (field !== activeField) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
  return dir === 'asc'
    ? <ArrowUp className="h-3.5 w-3.5" />
    : <ArrowDown className="h-3.5 w-3.5" />
}

export function ListsTable({
  lists,
  isLoading,
  onView,
  onEdit,
  onDelete,
  selectedIds,
  onSelectedIdsChange,
  page = 1,
  pageSize = 25,
}: ListsTableProps) {
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const hasBulkSelect = !!selectedIds && !!onSelectedIdsChange

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'name' ? 'asc' : 'desc')
    }
  }

  const sortedLists = useMemo(() => {
    const sorted = [...lists]
    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'contact_count':
          cmp = (a.contact_count || 0) - (b.contact_count || 0)
          break
        case 'created_at':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [lists, sortField, sortDir])

  const paginatedLists = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedLists.slice(start, start + pageSize)
  }, [sortedLists, page, pageSize])

  const toggleSelect = (listId: string) => {
    if (!selectedIds || !onSelectedIdsChange) return
    const next = new Set(selectedIds)
    if (next.has(listId)) next.delete(listId)
    else next.add(listId)
    onSelectedIdsChange(next)
  }

  const toggleSelectAll = () => {
    if (!selectedIds || !onSelectedIdsChange) return
    if (selectedIds.size === paginatedLists.length) {
      onSelectedIdsChange(new Set())
    } else {
      onSelectedIdsChange(new Set(paginatedLists.map((l) => l.id)))
    }
  }

  if (isLoading) {
    return (
      <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700">
        <Table>
          <TableHeader>
            <TableRow>
              {hasBulkSelect && <TableHead className="w-[40px]" />}
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Contacts</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {hasBulkSelect && <TableCell><Skeleton className="h-4 w-4" /></TableCell>}
                <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                <TableCell><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
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
      <div className="border rounded-lg p-12 text-center bg-white dark:bg-slate-900 dark:border-slate-700">
        <ListIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No lists yet</h3>
        <p className="text-muted-foreground">
          Create your first list to organise your contacts.
        </p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700">
      <Table className="table-fixed w-full">
        <TableHeader>
          <TableRow>
            {hasBulkSelect && (
              <TableHead className="w-10 px-2">
                <Checkbox
                  checked={paginatedLists.length > 0 && selectedIds.size === paginatedLists.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
            )}
            <TableHead className="w-[25%]">
              <button onClick={() => toggleSort('name')} className={cn("flex items-center gap-1 hover:text-foreground transition-colors", sortField === 'name' && "text-foreground")}>
                Name <SortIcon field="name" activeField={sortField} dir={sortDir} />
              </button>
            </TableHead>
            <TableHead className="w-[35%]">Description</TableHead>
            <TableHead className="w-[12%] text-right">
              <button onClick={() => toggleSort('contact_count')} className={cn("flex items-center gap-1 ml-auto hover:text-foreground transition-colors", sortField === 'contact_count' && "text-foreground")}>
                Contacts <SortIcon field="contact_count" activeField={sortField} dir={sortDir} />
              </button>
            </TableHead>
            <TableHead className="w-[15%]">
              <button onClick={() => toggleSort('created_at')} className={cn("flex items-center gap-1 hover:text-foreground transition-colors", sortField === 'created_at' && "text-foreground")}>
                Created <SortIcon field="created_at" activeField={sortField} dir={sortDir} />
              </button>
            </TableHead>
            <TableHead className="w-[60px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedLists.map((list) => {
            const isSelected = hasBulkSelect && selectedIds.has(list.id)

            return (
              <TableRow
                key={list.id}
                className={cn(
                  'cursor-pointer hover:bg-muted/50',
                  isSelected && 'bg-blue-50/50 dark:bg-blue-900/10'
                )}
                onClick={() => onView(list)}
              >
                {hasBulkSelect && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(list.id)}
                    />
                  </TableCell>
                )}

                {/* Name */}
                <TableCell className="overflow-hidden">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg shrink-0">
                      <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white truncate" title={list.name}>{list.name}</span>
                  </div>
                </TableCell>

                {/* Description */}
                <TableCell className="text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                  {list.description || '\u2014'}
                </TableCell>

                {/* Contacts Count */}
                <TableCell className="text-right">
                  <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {list.contact_count?.toLocaleString() || 0}
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
                        <MoreVertical className="h-4 w-4" />
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
                      {onDelete && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDelete(list)}
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
