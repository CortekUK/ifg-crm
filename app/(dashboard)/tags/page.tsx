'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Search,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Tag,
  Crown,
  CalendarPlus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Merge,
  Loader2,
  Tags,
  Eye,
} from 'lucide-react'
import { useTagsWithCounts, useDeleteTag, useBulkDeleteTags, useMergeTags, useUpdateTag } from '@/lib/hooks/useTags'
import type { TagWithCount } from '@/lib/hooks/useTags'
import { CreateTagModal } from '@/components/tags/CreateTagModal'
import { TagDetailSheet } from '@/components/tags/TagDetailSheet'
import { PageHeader } from '@/components/shared/PageHeader'
import { toast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'
import { formatNumber, formatDate } from '@/lib/utils/format'

type SortField = 'name' | 'contact_count' | 'created_at'
type SortOrder = 'asc' | 'desc'

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'tournament', label: 'Tournament' },
  { value: 'skill', label: 'Skill' },
  { value: 'priority', label: 'Priority' },
  { value: 'location', label: 'Location' },
  { value: 'source', label: 'Source' },
  { value: 'gender', label: 'Gender' },
  { value: 'year', label: 'Year' },
  { value: 'programme', label: 'Programme' },
  { value: 'position', label: 'Position' },
  { value: 'other', label: 'Other' },
  { value: 'none', label: 'Uncategorised' },
]

const colourConfig = {
  blue: {
    gradient: 'from-blue-50/60 dark:from-blue-950/60',
    border: 'border-l-blue-400',
    iconBg: 'bg-blue-100 dark:bg-blue-900/50',
    iconColour: 'text-blue-600 dark:text-blue-400',
  },
  amber: {
    gradient: 'from-amber-50/60 dark:from-amber-950/60',
    border: 'border-l-amber-400',
    iconBg: 'bg-amber-100 dark:bg-amber-900/50',
    iconColour: 'text-amber-600 dark:text-amber-400',
  },
  green: {
    gradient: 'from-green-50/60 dark:from-green-950/60',
    border: 'border-l-green-400',
    iconBg: 'bg-green-100 dark:bg-green-900/50',
    iconColour: 'text-green-600 dark:text-green-400',
  },
}

export default function TagsPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [editingTag, setEditingTag] = useState<TagWithCount | null>(null)
  const [tagToDelete, setTagToDelete] = useState<TagWithCount | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set())
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [mergeTargetId, setMergeTargetId] = useState<string>('')
  const [selectedTag, setSelectedTag] = useState<TagWithCount | null>(null)

  // Inline editing state
  const [inlineEditId, setInlineEditId] = useState<string | null>(null)
  const [inlineEditValue, setInlineEditValue] = useState('')
  const inlineInputRef = useRef<HTMLInputElement>(null)

  const { data: tags = [], isLoading } = useTagsWithCounts()
  const deleteTag = useDeleteTag()
  const bulkDeleteTags = useBulkDeleteTags()
  const mergeTags = useMergeTags()
  const updateTag = useUpdateTag()

  // Focus inline edit input when it appears
  useEffect(() => {
    if (inlineEditId && inlineInputRef.current) {
      inlineInputRef.current.focus()
      inlineInputRef.current.select()
    }
  }, [inlineEditId])

  // Computed stats
  const stats = useMemo(() => {
    const now = new Date()
    const thisMonth = tags.filter((t) => {
      const created = new Date(t.created_at)
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
    })
    const mostUsed = tags.reduce<TagWithCount | null>(
      (best, tag) => (!best || tag.contact_count > best.contact_count ? tag : best),
      null
    )
    return {
      total: tags.length,
      mostUsedName: mostUsed?.name || 'None',
      mostUsedCount: mostUsed?.contact_count || 0,
      createdThisMonth: thisMonth.length,
    }
  }, [tags])

  // Filter + sort
  const filteredTags = useMemo(() => {
    let result = tags

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (tag) =>
          tag.name.toLowerCase().includes(q) ||
          (tag.category && tag.category.toLowerCase().includes(q)) ||
          (tag.description && tag.description.toLowerCase().includes(q))
      )
    }

    // Category filter
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'none') {
        result = result.filter((tag) => !tag.category)
      } else {
        result = result.filter((tag) => tag.category === categoryFilter)
      }
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name)
      } else if (sortField === 'contact_count') {
        cmp = a.contact_count - b.contact_count
      } else if (sortField === 'created_at') {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

    return result
  }, [tags, search, categoryFilter, sortField, sortOrder])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
    return sortOrder === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5" />
      : <ArrowDown className="h-3.5 w-3.5" />
  }

  const handleEdit = (tag: TagWithCount) => {
    setEditingTag(tag)
    setIsCreateModalOpen(true)
  }

  const handleDelete = async () => {
    if (!tagToDelete) return
    try {
      await deleteTag.mutateAsync(tagToDelete.id)
      selectedTagIds.delete(tagToDelete.id)
      setSelectedTagIds(new Set(selectedTagIds))
      toast({ title: 'Tag deleted', description: `"${tagToDelete.name}" has been deleted.` })
    } catch {
      toast({ title: 'Error', description: 'Failed to delete tag.', variant: 'destructive' })
    }
    setTagToDelete(null)
  }

  const handleBulkDelete = async () => {
    try {
      await bulkDeleteTags.mutateAsync(Array.from(selectedTagIds))
      toast({ title: 'Tags deleted', description: `${selectedTagIds.size} tag(s) have been deleted.` })
      setSelectedTagIds(new Set())
    } catch {
      toast({ title: 'Error', description: 'Failed to delete tags.', variant: 'destructive' })
    }
    setShowBulkDeleteDialog(false)
  }

  const handleMerge = async () => {
    if (!mergeTargetId) return
    const mergeIds = Array.from(selectedTagIds).filter((id) => id !== mergeTargetId)
    if (mergeIds.length === 0) return

    try {
      await mergeTags.mutateAsync({ keepTagId: mergeTargetId, mergeTagIds: mergeIds })
      const keepTag = tags.find((t) => t.id === mergeTargetId)
      toast({
        title: 'Tags merged',
        description: `${mergeIds.length} tag(s) merged into "${keepTag?.name}".`,
      })
      setSelectedTagIds(new Set())
    } catch {
      toast({ title: 'Error', description: 'Failed to merge tags.', variant: 'destructive' })
    }
    setShowMergeDialog(false)
    setMergeTargetId('')
  }

  const handleInlineEditSubmit = async (tagId: string) => {
    const trimmed = inlineEditValue.trim()
    const tag = tags.find((t) => t.id === tagId)
    if (!trimmed || !tag || trimmed === tag.name) {
      setInlineEditId(null)
      return
    }
    try {
      await updateTag.mutateAsync({ id: tagId, name: trimmed })
      toast({ title: 'Tag renamed', description: `Tag renamed to "${trimmed}".` })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : ''
      const isDuplicate = message.includes('duplicate') || message.includes('unique')
      toast({
        title: isDuplicate ? 'Duplicate name' : 'Error',
        description: isDuplicate ? `"${trimmed}" already exists.` : 'Failed to rename tag.',
        variant: 'destructive',
      })
    }
    setInlineEditId(null)
  }

  const handleCreateClick = () => {
    setEditingTag(null)
    setIsCreateModalOpen(true)
  }

  const toggleSelectTag = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev)
      if (next.has(tagId)) next.delete(tagId)
      else next.add(tagId)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedTagIds.size === filteredTags.length) {
      setSelectedTagIds(new Set())
    } else {
      setSelectedTagIds(new Set(filteredTags.map((t) => t.id)))
    }
  }

  const formatCategory = (cat: string | null) => {
    if (!cat) return '\u2014'
    return cat.charAt(0).toUpperCase() + cat.slice(1)
  }

  const selectedTags = tags.filter((t) => selectedTagIds.has(t.id))
  const totalSelectedContacts = selectedTags.reduce((sum, t) => sum + t.contact_count, 0)

  // Stat card data
  const statCards = [
    {
      label: 'Total Tags',
      value: stats.total,
      icon: Tag,
      colour: 'blue' as const,
    },
    {
      label: 'Most Used Tag',
      value: stats.mostUsedCount,
      subtitle: stats.mostUsedName,
      icon: Crown,
      colour: 'amber' as const,
    },
    {
      label: 'Created This Month',
      value: stats.createdThisMonth,
      icon: CalendarPlus,
      colour: 'green' as const,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Banner */}
      <PageHeader
        subtitle="Organise and segment your contacts with tags for quick filtering and targeting."
        actions={
          <Button onClick={handleCreateClick} className="bg-white text-blue-600 hover:bg-blue-50">
            <Plus className="h-4 w-4 mr-2" />
            Create Tag
          </Button>
        }
      />

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {statCards.map((stat, i) => {
            const config = colourConfig[stat.colour]
            return (
              <Card key={i} className={cn(
                'relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm border-l-4',
                config.border
              )}>
                <div className={cn(
                  'absolute inset-x-0 top-0 h-12 bg-gradient-to-b to-transparent pointer-events-none',
                  config.gradient
                )} />
                <CardContent className="relative z-10 px-2.5 py-1">
                  <div className="flex items-start justify-between mb-0">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                  <Skeleton className="h-7 w-14" />
                  {stat.subtitle && <Skeleton className="h-4 w-32 mt-1" />}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {statCards.map((stat) => {
            const Icon = stat.icon
            const config = colourConfig[stat.colour]
            return (
              <Card key={stat.label} className={cn(
                'relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow transition-shadow border-l-4',
                config.border
              )}>
                <div className={cn(
                  'absolute inset-x-0 top-0 h-12 bg-gradient-to-b to-transparent pointer-events-none',
                  config.gradient
                )} />
                <CardContent className="relative z-10 px-2.5 py-1">
                  <div className="flex items-start justify-between mb-0">
                    <p className="font-oswald text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                      {stat.label}
                    </p>
                    <div className={cn('p-1 rounded-full', config.iconBg)}>
                      <Icon className={cn('h-4 w-4', config.iconColour)} />
                    </div>
                  </div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatNumber(stat.value)}
                  </p>
                  {stat.subtitle && (
                    <p className="text-sm text-muted-foreground mt-1 truncate" title={stat.subtitle}>
                      {stat.subtitle}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Search + Category Filter + Bulk Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tags..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedTagIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-muted-foreground">
              {selectedTagIds.size} selected
            </span>
            {selectedTagIds.size >= 2 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMergeTargetId('')
                  setShowMergeDialog(true)
                }}
              >
                <Merge className="h-4 w-4 mr-1.5" />
                Merge
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Tags Table */}
      {isLoading ? (
        <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" />
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Contacts</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[70px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : filteredTags.length === 0 ? (
        <div className="border rounded-lg p-12 text-center bg-white dark:bg-slate-900 dark:border-slate-700">
          <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 mx-auto">
            <Tags className="h-8 w-8 text-slate-400 dark:text-slate-500" />
          </div>
          {search || categoryFilter !== 'all' ? (
            <>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No tags found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search or filter.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => { setSearch(''); setCategoryFilter('all') }}
              >
                Clear filters
              </Button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No tags yet</h3>
              <p className="text-muted-foreground">
                Tags help you organise and segment your contacts. Create your first tag to get started.
              </p>
              <Button className="mt-4" onClick={handleCreateClick}>
                <Plus className="h-4 w-4 mr-2" />
                Create Tag
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 px-2">
                  <Checkbox
                    checked={
                      filteredTags.length > 0 &&
                      selectedTagIds.size === filteredTags.length
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[35%]">
                  <button
                    onClick={() => handleSort('name')}
                    className={cn(
                      'flex items-center gap-1 hover:text-foreground transition-colors',
                      sortField === 'name' && 'text-foreground'
                    )}
                  >
                    Name <SortIcon field="name" />
                  </button>
                </TableHead>
                <TableHead className="w-[15%]">Category</TableHead>
                <TableHead className="w-[12%] text-right">
                  <button
                    onClick={() => handleSort('contact_count')}
                    className={cn(
                      'flex items-center gap-1 ml-auto hover:text-foreground transition-colors',
                      sortField === 'contact_count' && 'text-foreground'
                    )}
                  >
                    Contacts <SortIcon field="contact_count" />
                  </button>
                </TableHead>
                <TableHead className="w-[15%]">
                  <button
                    onClick={() => handleSort('created_at')}
                    className={cn(
                      'flex items-center gap-1 hover:text-foreground transition-colors',
                      sortField === 'created_at' && 'text-foreground'
                    )}
                  >
                    Created <SortIcon field="created_at" />
                  </button>
                </TableHead>
                <TableHead className="w-[60px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTags.map((tag) => {
                const isSelected = selectedTagIds.has(tag.id)
                const isInlineEditing = inlineEditId === tag.id

                return (
                  <TableRow
                    key={tag.id}
                    className={cn(
                      'cursor-pointer hover:bg-muted/50',
                      isSelected && 'bg-blue-50/50 dark:bg-blue-900/10'
                    )}
                    onClick={() => setSelectedTag(tag)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelectTag(tag.id)}
                      />
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="p-2 rounded-lg shrink-0"
                          style={{ backgroundColor: `${tag.color || '#3b82f6'}20` }}
                        >
                          <Tag className="h-4 w-4" style={{ color: tag.color || '#3b82f6' }} />
                        </div>
                        {isInlineEditing ? (
                          <Input
                            ref={inlineInputRef}
                            className="h-7 text-sm px-2 w-48"
                            value={inlineEditValue}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setInlineEditValue(e.target.value)}
                            onBlur={() => handleInlineEditSubmit(tag.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleInlineEditSubmit(tag.id)
                              if (e.key === 'Escape') setInlineEditId(null)
                            }}
                          />
                        ) : (
                          <span className="font-medium text-gray-900 dark:text-white truncate" title={tag.name}>{tag.name}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatCategory(tag.category)}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Badge
                        variant="secondary"
                        className={cn(
                          'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
                          tag.contact_count > 0 && 'cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700'
                        )}
                        onClick={() => {
                          if (tag.contact_count > 0) router.push(`/contacts?tag_id=${tag.id}`)
                        }}
                      >
                        {tag.contact_count.toLocaleString()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(tag.created_at)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedTag(tag)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Contacts
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(tag)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setTagToDelete(tag)}
                            className="text-red-600"
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
      )}

      {/* Tag Detail Sheet */}
      <TagDetailSheet
        tag={selectedTag}
        isOpen={!!selectedTag}
        onClose={() => setSelectedTag(null)}
      />

      {/* Create/Edit Tag Modal */}
      <CreateTagModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          setEditingTag(null)
        }}
        editingTag={editingTag}
      />

      {/* Single Delete Confirmation */}
      <AlertDialog open={!!tagToDelete} onOpenChange={() => setTagToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-medium">&ldquo;{tagToDelete?.name}&rdquo;</span>?
              This will remove the tag from {tagToDelete?.contact_count || 0} contact{tagToDelete?.contact_count === 1 ? '' : 's'}.
              The contacts themselves will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedTagIds.size} tags?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete{' '}
              <span className="font-medium">{selectedTagIds.size} tag{selectedTagIds.size === 1 ? '' : 's'}</span>{' '}
              and remove them from {totalSelectedContacts} contact{totalSelectedContacts === 1 ? '' : 's'}.
              The contacts themselves will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={bulkDeleteTags.isPending}
            >
              {bulkDeleteTags.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting...</>
              ) : (
                'Delete All'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Merge Dialog */}
      <AlertDialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge {selectedTagIds.size} tags</AlertDialogTitle>
            <AlertDialogDescription>
              All contacts from the other tag{selectedTagIds.size > 2 ? 's' : ''} will be reassigned to the tag you keep.
              The other tag{selectedTagIds.size > 2 ? 's' : ''} will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Keep this tag:</label>
            <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Select the tag to keep" />
              </SelectTrigger>
              <SelectContent>
                {selectedTags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full inline-block"
                        style={{ backgroundColor: tag.color || '#3b82f6' }}
                      />
                      {tag.name}
                      <span className="text-muted-foreground">({tag.contact_count})</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMerge}
              disabled={!mergeTargetId || mergeTags.isPending}
            >
              {mergeTags.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Merging...</>
              ) : (
                'Merge Tags'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
