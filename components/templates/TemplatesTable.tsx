'use client'

import { useState, useMemo } from 'react'
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
import {
  MoreHorizontal,
  Eye,
  Pencil,
  Copy,
  Trash2,
  Mail,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { Template } from '@/lib/types/templates'

interface TemplatesTableProps {
  templates: Template[]
  isLoading: boolean
  onEdit: (template: Template) => void
  onDelete: (template: Template) => void
  onDuplicate: (template: Template) => void
  onPreview: (template: Template) => void
}

const categoryConfig: Record<Template['category'], { label: string; className: string }> = {
  automation: { label: 'Automation', className: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' },
  campaign: { label: 'Campaign', className: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' },
  transactional: { label: 'Transactional', className: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' },
}

type SortField = 'name' | 'subject' | 'category' | 'updated_at'
type SortDir = 'asc' | 'desc'

function SortIcon({ field, activeField, dir }: { field: SortField; activeField: SortField; dir: SortDir }) {
  if (field !== activeField) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
  return dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
}

const PAGE_SIZE = 10

export function TemplatesTable({
  templates,
  isLoading,
  onEdit,
  onDelete,
  onDuplicate,
  onPreview,
}: TemplatesTableProps) {
  const [sortField, setSortField] = useState<SortField>('updated_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'name' || field === 'subject' ? 'asc' : 'desc')
    }
  }

  const sortedTemplates = useMemo(() => {
    const sorted = [...templates]
    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'subject':
          cmp = (a.subject || '').localeCompare(b.subject || '')
          break
        case 'category':
          cmp = a.category.localeCompare(b.category)
          break
        case 'updated_at':
          cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [templates, sortField, sortDir])

  // Reset to first page whenever the filtered/sorted set changes so a
  // search that narrows results doesn't strand the user on page 5 of a
  // 1-page list.
  const totalPages = Math.max(1, Math.ceil(sortedTemplates.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const pageItems = sortedTemplates.slice(pageStart, pageStart + PAGE_SIZE)

  if (isLoading) {
    return (
      <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[260px]">Name</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="w-[120px]">Category</TableHead>
              <TableHead className="w-[120px]">Last Updated</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (templates.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center bg-white dark:bg-slate-900 dark:border-slate-700">
        <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No templates yet</h3>
        <p className="text-muted-foreground">
          Create your first template to streamline your communications.
        </p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[260px] cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('name')}>
              <div className="flex items-center gap-1">
                Name <SortIcon field="name" activeField={sortField} dir={sortDir} />
              </div>
            </TableHead>
            <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('subject')}>
              <div className="flex items-center gap-1">
                Subject <SortIcon field="subject" activeField={sortField} dir={sortDir} />
              </div>
            </TableHead>
            <TableHead className="w-[120px] cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('category')}>
              <div className="flex items-center gap-1">
                Category <SortIcon field="category" activeField={sortField} dir={sortDir} />
              </div>
            </TableHead>
            <TableHead className="w-[120px] cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('updated_at')}>
              <div className="flex items-center gap-1">
                Last Updated <SortIcon field="updated_at" activeField={sortField} dir={sortDir} />
              </div>
            </TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((template) => {
            const category = categoryConfig[template.category]

            return (
              <TableRow
                key={template.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onPreview(template)}
              >
                {/* Name — fixed-width column with truncation. The
                    inner div has an explicit max-width so `truncate`
                    actually clips the text (CSS truncate needs a
                    bounded parent; HTML tables auto-size cells to
                    their content otherwise). Hover shows full text. */}
                <TableCell className="max-w-[260px]">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded bg-gray-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      <Mail className="h-4 w-4 text-gray-400 dark:text-slate-500" />
                    </div>
                    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                      <span
                        className="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-white"
                        title={template.name}
                      >
                        {template.name}
                      </span>
                      {template.is_draft && (
                        <Badge className="shrink-0 border-amber-200 bg-amber-50 text-[10px] font-normal text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                          Draft
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>

                {/* Subject — same truncation treatment. Bounded
                    max-width on the cell so very long subjects don't
                    push category / date columns off-screen. */}
                <TableCell className="max-w-[400px] text-sm text-muted-foreground">
                  <span
                    className="block truncate"
                    title={template.subject || ''}
                  >
                    {template.subject || 'No subject'}
                  </span>
                </TableCell>

                {/* Category */}
                <TableCell>
                  <Badge className={cn('text-xs font-normal', category.className)}>
                    {category.label}
                  </Badge>
                </TableCell>

                {/* Last Updated */}
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(template.updated_at)}
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
                      <DropdownMenuItem onClick={() => onPreview(template)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(template)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDuplicate(template)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(template)}
                        className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/30"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {/* Pagination footer — only renders when there's more than one
          page. Shows "Showing X-Y of N" plus prev/next + jump buttons.
          PAGE_SIZE is currently 10; bump if the list gets dense. */}
      {sortedTemplates.length > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-2.5 text-xs text-muted-foreground dark:border-slate-700 dark:bg-slate-800/30">
          <span>
            Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, sortedTemplates.length)} of{' '}
            {sortedTemplates.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 tabular-nums">
              Page {safePage} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
