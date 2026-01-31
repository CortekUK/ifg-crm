'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
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
import { Search } from 'lucide-react'
import {
  ListsTable,
  ListDetailSheet,
  CreateListModal,
  AddContactsToListModal,
  ListsPageHeader,
  ListStats,
} from '@/components/lists'
import { useLists, useListStats, useDeleteList } from '@/lib/hooks/useLists'
import { toast } from '@/lib/hooks/use-toast'
import type { List, ListFilters } from '@/lib/types/lists'

export default function ListsPage() {
  const [filters, setFilters] = useState<ListFilters>({})
  const [selectedList, setSelectedList] = useState<List | null>(null)
  const [editingList, setEditingList] = useState<List | null>(null)
  const [listToDelete, setListToDelete] = useState<List | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [addContactsListId, setAddContactsListId] = useState<string | null>(null)

  const { data: lists = [], isLoading: listsLoading } = useLists(filters)
  const { data: stats, isLoading: statsLoading } = useListStats()
  const deleteList = useDeleteList()

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
      toast({
        title: 'List deleted',
        description: `"${listToDelete.name}" has been deleted.`,
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete list.',
        variant: 'destructive',
      })
    }
    setListToDelete(null)
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

      {/* Search */}
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
      </div>

      {/* Lists Table */}
      <ListsTable
        lists={lists}
        isLoading={listsLoading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={setListToDelete}
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!listToDelete} onOpenChange={() => setListToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete list?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-medium">"{listToDelete?.name}"</span>?
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
    </div>
  )
}
