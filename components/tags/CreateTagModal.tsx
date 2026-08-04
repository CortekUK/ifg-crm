'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateTag, useUpdateTag } from '@/lib/hooks/useTags'
import { toast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { ContactTag } from '@/lib/types/contacts'

const TAG_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
]

const TAG_CATEGORIES = [
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
]

interface CreateTagModalProps {
  isOpen: boolean
  onClose: () => void
  editingTag?: (ContactTag & { description?: string | null }) | null
}

export function CreateTagModal({ isOpen, onClose, editingTag }: CreateTagModalProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(TAG_COLORS[5])
  const [category, setCategory] = useState<string>('')
  const [description, setDescription] = useState('')

  const createTag = useCreateTag()
  const updateTag = useUpdateTag()

  const isEditing = !!editingTag

  useEffect(() => {
    if (editingTag) {
      setName(editingTag.name)
      setColor(editingTag.color || TAG_COLORS[5])
      setCategory(editingTag.category || '')
      setDescription(editingTag.description || '')
    } else {
      setName('')
      setColor(TAG_COLORS[5])
      setCategory('')
      setDescription('')
    }
  }, [editingTag, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      if (isEditing && editingTag) {
        await updateTag.mutateAsync({
          id: editingTag.id,
          name: name.trim(),
          color,
          category: category || null,
          description: description.trim() || null,
        })
        toast({ title: 'Tag updated', description: `"${name.trim()}" has been updated.` })
      } else {
        await createTag.mutateAsync({
          name: name.trim(),
          color,
          category: category || null,
          description: description.trim() || null,
        })
        toast({ title: 'Tag created', description: `"${name.trim()}" has been created.` })
      }
      onClose()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Something went wrong'
      const isDuplicate = message.includes('duplicate') || message.includes('unique') || message.includes('already exists')
      toast({
        title: isDuplicate ? 'Duplicate tag name' : 'Error',
        description: isDuplicate ? `A tag named "${name.trim()}" already exists.` : message,
        variant: 'destructive',
      })
    }
  }

  const isPending = createTag.isPending || updateTag.isPending

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Tag' : 'Create Tag'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tag-name">Name <span className="text-red-500">*</span></Label>
            <Input
              id="tag-name"
              placeholder="e.g. High Priority"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {TAG_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-8 w-8 rounded-full border-2 transition-all',
                    color === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tag-description">Description</Label>
            <Textarea
              id="tag-description"
              placeholder="Optional description for this tag..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isPending}>
              {isPending ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Tag')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
