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

  if (isLoading) {
    return (
      <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Name</TableHead>
              <TableHead className="min-w-[200px]">Subject</TableHead>
              <TableHead className="w-[120px]">Category</TableHead>
              <TableHead className="w-[100px]">Sender</TableHead>
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
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
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
            <TableHead className="min-w-[200px] cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('name')}>
              <div className="flex items-center gap-1">
                Name <SortIcon field="name" activeField={sortField} dir={sortDir} />
              </div>
            </TableHead>
            <TableHead className="min-w-[200px] cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('subject')}>
              <div className="flex items-center gap-1">
                Subject <SortIcon field="subject" activeField={sortField} dir={sortDir} />
              </div>
            </TableHead>
            <TableHead className="w-[120px] cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('category')}>
              <div className="flex items-center gap-1">
                Category <SortIcon field="category" activeField={sortField} dir={sortDir} />
              </div>
            </TableHead>
            <TableHead className="w-[100px]">Sender</TableHead>
            <TableHead className="w-[120px] cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('updated_at')}>
              <div className="flex items-center gap-1">
                Last Updated <SortIcon field="updated_at" activeField={sortField} dir={sortDir} />
              </div>
            </TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTemplates.map((template) => {
            const category = categoryConfig[template.category]

            return (
              <TableRow
                key={template.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onPreview(template)}
              >
                {/* Name */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded bg-gray-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      <Mail className="h-4 w-4 text-gray-400 dark:text-slate-500" />
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
                      {template.name}
                    </span>
                  </div>
                </TableCell>

                {/* Subject */}
                <TableCell className="text-sm text-muted-foreground">
                  <span className="truncate block max-w-[240px]">
                    {template.subject || 'No subject'}
                  </span>
                </TableCell>

                {/* Category */}
                <TableCell>
                  <Badge className={cn('text-xs font-normal', category.className)}>
                    {category.label}
                  </Badge>
                </TableCell>

                {/* Sender */}
                <TableCell className="text-sm text-muted-foreground">
                  {template.from_name_type === 'deal_owner' ? 'Deal Owner' : (template.fixed_from_name || '—')}
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
    </div>
  )
}
