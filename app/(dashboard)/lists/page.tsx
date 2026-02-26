'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
import { Search, Trash2, Loader2 } from 'lucide-react'
import {
  ListsTable,
  ListDetailSheet,
  CreateListModal,
  AddContactsToListModal,
  ListsPageHeader,
  ListStats,
} from '@/components/lists'
import { useLists, useListStats, useDeleteList, useBulkDeleteLists } from '@/lib/hooks/useLists'
import { toast } from '@/lib/hooks/use-toast'
import type { List, ListFilters } from '@/lib/types/lists'

export default function ListsPage() {
  const [filters, setFilters] = useState<ListFilters>({})
  const [selectedList, setSelectedList] = useState<List | null>(null)
  const [editingList, setEditingList] = useState<List | null>(null)
  const [listToDelete, setListToDelete] = useState<List | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [addContactsListId, setAddContactsListId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)

  const { data: lists = [], isLoading: listsLoading } = useLists(filters)
  const { data: stats, isLoading: statsLoading } = useListStats()
  const deleteList = useDeleteList()
  const bulkDeleteLists = useBulkDeleteLists()

  const handleSearch = (search: string) => {
    setFilters((prev) => ({ ...prev, search }))
  }

  const handleView = (list: List) => {
    setSelectedList(list)
  }

  const handleEdit = (list: List) => {
    setEditingList(list)
    setIsCreateModalOpen(true)
  }

  const handleDelete = async () => {
    if (!listToDelete) return

    try {
      await deleteList.mutateAsync(listToDelete.id)
      selectedIds.delete(listToDelete.id)
      setSelectedIds(new Set(selectedIds))
      toast({
        title: 'List deleted',
        description: `"${listToDelete.name}" has been deleted.`,
      })
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete list.',
        variant: 'destructive',
      })
    }
    setListToDelete(null)
  }

  const handleBulkDelete = async () => {
    try {
      await bulkDeleteLists.mutateAsync(Array.from(selectedIds))
      toast({
        title: 'Lists deleted',
        description: `${selectedIds.size} list(s) have been deleted.`,
      })
      setSelectedIds(new Set())
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete lists.',
        variant: 'destructive',
      })
    }
    setShowBulkDeleteDialog(false)
  }

  const handleAddContacts = () => {
    if (selectedList) {
      setAddContactsListId(selectedList.id)
    }
  }

  const handleCreateClick = () => {
    setEditingList(null)
    setIsCreateModalOpen(true)
  }

  const totalSelectedContacts = lists
    .filter((l) => selectedIds.has(l.id))
    .reduce((sum, l) => sum + (l.contact_count || 0), 0)

  return (
    <div className="space-y-6">
      {/* Page Header with Banner */}
      <ListsPageHeader onCreateClick={handleCreateClick} />

      {/* Stats */}
      <ListStats
        totalLists={stats?.totalLists || 0}
        totalContacts={stats?.totalContacts || 0}
        largestListName={stats?.largestListName || 'None'}
        largestListCount={stats?.largestListCount || 0}
        isLoading={statsLoading}
      />

      {/* Search + Bulk Actions */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search lists..."
            className="pl-9"
            value={filters.search || ''}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selected
            </span>
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

      {/* Lists Table */}
      <ListsTable
        lists={lists}
        isLoading={listsLoading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={setListToDelete}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
      />

      {/* List Detail Sheet */}
      <ListDetailSheet
        listId={selectedList?.id || null}
        isOpen={!!selectedList}
        onClose={() => setSelectedList(null)}
        onAddContacts={handleAddContacts}
      />

      {/* Create/Edit List Modal */}
      <CreateListModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          setEditingList(null)
        }}
        editingList={editingList}
      />

      {/* Add Contacts Modal */}
      <AddContactsToListModal
        isOpen={!!addContactsListId}
        onClose={() => setAddContactsListId(null)}
        listId={addContactsListId}
        listName={selectedList?.name || ''}
      />

      {/* Single Delete Confirmation */}
      <AlertDialog open={!!listToDelete} onOpenChange={() => setListToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete list?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-medium">&ldquo;{listToDelete?.name}&rdquo;</span>?
              This will remove all contacts from this list. The contacts themselves will not be deleted.
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
            <AlertDialogTitle>Delete {selectedIds.size} lists?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete{' '}
              <span className="font-medium">{selectedIds.size} list{selectedIds.size === 1 ? '' : 's'}</span>{' '}
              and remove {totalSelectedContacts} contact{totalSelectedContacts === 1 ? '' : 's'} from them.
              The contacts themselves will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={bulkDeleteLists.isPending}
            >
              {bulkDeleteLists.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting...</>
              ) : (
                'Delete All'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
