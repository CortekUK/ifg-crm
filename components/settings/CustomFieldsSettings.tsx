'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Trash2, Loader2, SlidersHorizontal } from 'lucide-react'
import { toast } from '@/lib/hooks/use-toast'

interface CustomField {
  id: string
  field_name: string
  field_label: string
  field_type: string
  options: string[] | null
  is_required: boolean
  display_order: number
  created_at: string
}

function useCustomFields() {
  const supabase = createClient()
  return useQuery<CustomField[]>({
    queryKey: ['custom-field-definitions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .order('display_order')
      if (error) throw error
      return data
    },
  })
}

function useCreateCustomField() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (field: Omit<CustomField, 'id' | 'created_at'>) => {
      const { error } = await supabase.from('custom_field_definitions').insert(field)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-field-definitions'] })
    },
  })
}

function useDeleteCustomField() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('custom_field_definitions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-field-definitions'] })
    },
  })
}

const fieldTypeLabels: Record<string, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  select: 'Dropdown',
  boolean: 'Yes/No',
}

export function CustomFieldsSettings() {
  const { data: fields, isLoading } = useCustomFields()
  const createField = useCreateCustomField()
  const deleteField = useDeleteCustomField()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [newField, setNewField] = useState({
    field_label: '',
    field_name: '',
    field_type: 'text',
    is_required: false,
    options: '',
  })

  const handleCreate = async () => {
    if (!newField.field_label.trim()) return

    const fieldName = newField.field_name.trim() ||
      newField.field_label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')

    try {
      await createField.mutateAsync({
        field_label: newField.field_label.trim(),
        field_name: fieldName,
        field_type: newField.field_type,
        is_required: newField.is_required,
        options: newField.field_type === 'select' && newField.options
          ? newField.options.split(',').map((o) => o.trim()).filter(Boolean)
          : null,
        display_order: (fields?.length || 0) + 1,
      })
      toast({ title: 'Field created', description: `"${newField.field_label}" has been added.` })
      setDialogOpen(false)
      setNewField({ field_label: '', field_name: '', field_type: 'text', is_required: false, options: '' })
    } catch (error) {
      toast({
        title: 'Failed to create field',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (field: CustomField) => {
    if (!confirm(`Delete custom field "${field.field_label}"? This won't remove existing data.`)) return
    try {
      await deleteField.mutateAsync(field.id)
      toast({ title: 'Field deleted', description: `"${field.field_label}" has been removed.` })
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Custom Fields</h2>
        <p className="text-sm text-muted-foreground">
          Define custom fields that appear on contact profiles. Data is stored in each contact&apos;s custom_fields JSON.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Field Definitions</CardTitle>
              <CardDescription>
                Manage the custom fields available for contacts.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Field
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !fields || fields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <SlidersHorizontal className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No custom fields defined yet.</p>
              <p className="text-xs mt-1">Click &quot;Add Field&quot; to create your first custom field.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Field Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field) => (
                  <TableRow key={field.id}>
                    <TableCell className="font-medium">{field.field_label}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{field.field_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {fieldTypeLabels[field.field_type] || field.field_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{field.is_required ? 'Yes' : 'No'}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700"
                        onClick={() => handleDelete(field)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Field Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Field</DialogTitle>
            <DialogDescription>
              Define a new custom field for contact profiles.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Field Label <span className="text-red-500">*</span></Label>
              <Input
                value={newField.field_label}
                onChange={(e) => setNewField((p) => ({ ...p, field_label: e.target.value }))}
                placeholder="e.g. Passport Number"
              />
            </div>
            <div className="space-y-2">
              <Label>Field Name (key)</Label>
              <Input
                value={newField.field_name}
                onChange={(e) => setNewField((p) => ({ ...p, field_name: e.target.value }))}
                placeholder="Auto-generated from label"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Used as the JSON key. Leave blank to auto-generate.</p>
            </div>
            <div className="space-y-2">
              <Label>Field Type</Label>
              <Select
                value={newField.field_type}
                onValueChange={(v) => setNewField((p) => ({ ...p, field_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="select">Dropdown</SelectItem>
                  <SelectItem value="boolean">Yes/No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newField.field_type === 'select' && (
              <div className="space-y-2">
                <Label>Options (comma-separated)</Label>
                <Input
                  value={newField.options}
                  onChange={(e) => setNewField((p) => ({ ...p, options: e.target.value }))}
                  placeholder="e.g. Option A, Option B, Option C"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch
                checked={newField.is_required}
                onCheckedChange={(v) => setNewField((p) => ({ ...p, is_required: v }))}
              />
              <Label>Required field</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={!newField.field_label.trim() || createField.isPending}
            >
              {createField.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
