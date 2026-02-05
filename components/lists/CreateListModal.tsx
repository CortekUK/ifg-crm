'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { useCreateList, useUpdateList } from '@/lib/hooks/useLists'
import { toast } from '@/lib/hooks/use-toast'
import type { List } from '@/lib/types/lists'

interface CreateListModalProps {
  isOpen: boolean
  onClose: () => void
  editingList?: List | null
}

export function CreateListModal({
  isOpen,
  onClose,
  editingList,
}: CreateListModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const createList = useCreateList()
  const updateList = useUpdateList()

  const isEditing = !!editingList
  const isLoading = createList.isPending || updateList.isPending

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (editingList) {
        setName(editingList.name)
        setDescription(editingList.description || '')
      } else {
        setName('')
        setDescription('')
      }
    }
  }, [isOpen, editingList])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) return

    try {
      if (isEditing) {
        await updateList.mutateAsync({
          id: editingList.id,
          name: name.trim(),
          description: description.trim() || undefined,
        })
        toast({
          title: 'List updated',
          description: `"${name}" has been updated.`,
        })
      } else {
        await createList.mutateAsync({
          name: name.trim(),
          description: description.trim() || undefined,
        })
        toast({
          title: 'List created',
          description: `"${name}" has been created.`,
        })
      }
      onClose()
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${isEditing ? 'update' : 'create'} list.`,
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
            {isEditing ? 'Edit List' : 'Create List'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the list details below.'
              : 'Create a new list to organise your contacts.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              List Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 2026 UCLan Prospects"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Description (optional)
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this list..."
              rows={3}
            />
          </div>


          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : isEditing ? (
                'Update List'
              ) : (
                'Create List'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
