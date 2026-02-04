'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Switch } from '@/components/ui/switch'
import { Loader2, Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Pencil } from 'lucide-react'
import { useUpdatePipeline, useDeletePipeline } from '@/lib/hooks/usePipelines'
import { usePipelineStages, useCreateStage, useUpdateStage, useDeleteStage, useReorderStages } from '@/lib/hooks/usePipelineStages'
import { useProgrammes } from '@/lib/hooks/useProgrammes'
import { toast } from '@/lib/hooks/use-toast'
import type { Pipeline, PipelineStage } from '@/lib/types/pipelines'

interface PipelineSettingsModalProps {
  pipeline: Pipeline | null
  isOpen: boolean
  onClose: () => void
}

const STAGE_TYPES: Array<{ value: PipelineStage['stage_type']; label: string }> = [
  { value: 'lead', label: 'Lead' },
  { value: 'contact', label: 'Contact' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'documents', label: 'Documents' },
  { value: 'applied', label: 'Applied' },
  { value: 'offer', label: 'Offer' },
  { value: 'payment', label: 'Payment' },
  { value: 'completed', label: 'Completed' },
  { value: 'lost', label: 'Lost' },
  { value: 'dormant', label: 'Dormant' },
]

const STAGE_COLORS = [
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#8b5cf6', // purple
  '#f97316', // orange
  '#22c55e', // green
  '#10b981', // emerald
  '#ef4444', // red
  '#ec4899', // pink
  '#f59e0b', // amber
  '#6366f1', // indigo
  '#84cc16', // lime
  '#64748b', // slate
]

export function PipelineSettingsModal({ pipeline, isOpen, onClose }: PipelineSettingsModalProps) {
  const [activeTab, setActiveTab] = useState('details')
  
  // Details form state
  const [name, setName] = useState('')
  const [sport, setSport] = useState<'football' | 'basketball'>('football')
  const [programmeId, setProgrammeId] = useState<string>('')
  const [isActive, setIsActive] = useState(true)
  
  // Stage editing state
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null)
  const [newStageName, setNewStageName] = useState('')
  const [newStageType, setNewStageType] = useState<PipelineStage['stage_type']>('lead')
  const [newStageColor, setNewStageColor] = useState('#3b82f6')
  const [isAddingStage, setIsAddingStage] = useState(false)
  
  // Delete confirmations
  const [showDeletePipelineDialog, setShowDeletePipelineDialog] = useState(false)
  const [stageToDelete, setStageToDelete] = useState<PipelineStage | null>(null)

  const { data: programmes = [] } = useProgrammes()
  const { data: stages = [], isLoading: stagesLoading } = usePipelineStages(pipeline?.id || null)
  
  const updatePipeline = useUpdatePipeline()
  const deletePipeline = useDeletePipeline()
  const createStage = useCreateStage()
  const updateStage = useUpdateStage()
  const deleteStage = useDeleteStage()
  const reorderStages = useReorderStages()

  // Reset form when pipeline changes
  useEffect(() => {
    if (pipeline && isOpen) {
      setName(pipeline.name)
      setSport(pipeline.sport)
      setProgrammeId(pipeline.programme_id || '')
      setIsActive(pipeline.is_active)
      setActiveTab('details')
      setEditingStage(null)
      setIsAddingStage(false)
    }
  }, [pipeline, isOpen])

  const handleSaveDetails = async () => {
    if (!pipeline || !name.trim()) return

    try {
      await updatePipeline.mutateAsync({
        pipelineId: pipeline.id,
        updates: {
          name: name.trim(),
          sport,
          programme_id: programmeId || null,
          is_active: isActive,
        },
      })

      toast({
        title: 'Pipeline updated',
        description: 'Pipeline settings have been saved.',
      })
    } catch (error) {
      toast({
        title: 'Failed to update pipeline',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleDeletePipeline = async () => {
    if (!pipeline) return

    try {
      await deletePipeline.mutateAsync(pipeline.id)
      toast({
        title: 'Pipeline deleted',
        description: `${pipeline.name} has been deleted.`,
      })
      setShowDeletePipelineDialog(false)
      onClose()
    } catch (error) {
      toast({
        title: 'Failed to delete pipeline',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleAddStage = async () => {
    if (!pipeline || !newStageName.trim()) return

    try {
      await createStage.mutateAsync({
        pipeline_id: pipeline.id,
        name: newStageName.trim(),
        stage_type: newStageType,
        color: newStageColor,
      })

      toast({
        title: 'Stage added',
        description: `${newStageName} has been added.`,
      })

      setNewStageName('')
      setNewStageType('lead')
      setNewStageColor('#3b82f6')
      setIsAddingStage(false)
    } catch (error) {
      toast({
        title: 'Failed to add stage',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleUpdateStage = async () => {
    if (!editingStage || !pipeline) return

    try {
      await updateStage.mutateAsync({
        stageId: editingStage.id,
        pipelineId: pipeline.id,
        updates: {
          name: editingStage.name,
          stage_type: editingStage.stage_type,
          color: editingStage.color,
        },
      })

      toast({
        title: 'Stage updated',
        description: 'Stage settings have been saved.',
      })

      setEditingStage(null)
    } catch (error) {
      toast({
        title: 'Failed to update stage',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteStage = async () => {
    if (!stageToDelete || !pipeline) return

    try {
      await deleteStage.mutateAsync({
        stageId: stageToDelete.id,
        pipelineId: pipeline.id,
      })

      toast({
        title: 'Stage deleted',
        description: `${stageToDelete.name} has been deleted.`,
      })

      setStageToDelete(null)
    } catch (error) {
      toast({
        title: 'Failed to delete stage',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleMoveStage = async (stageId: string, direction: 'up' | 'down') => {
    if (!pipeline) return

    const sortedStages = [...stages].sort((a, b) => a.display_order - b.display_order)
    const currentIndex = sortedStages.findIndex((s) => s.id === stageId)
    
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === sortedStages.length - 1)
    ) {
      return
    }

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    
    // Swap display orders
    const newStages = sortedStages.map((stage, index) => {
      if (index === currentIndex) {
        return { id: stage.id, display_order: sortedStages[swapIndex].display_order }
      }
      if (index === swapIndex) {
        return { id: stage.id, display_order: sortedStages[currentIndex].display_order }
      }
      return { id: stage.id, display_order: stage.display_order }
    })

    try {
      await reorderStages.mutateAsync({
        pipelineId: pipeline.id,
        stages: newStages,
      })
    } catch (error) {
      toast({
        title: 'Failed to reorder stages',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  if (!pipeline) return null

  const sortedStages = [...stages].sort((a, b) => a.display_order - b.display_order)

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="sm:max-w-lg flex flex-col p-0 gap-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
              Pipeline Settings
            </SheetTitle>
            <SheetDescription>
              Configure {pipeline.name}
            </SheetDescription>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-6 mt-4 grid w-auto grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="stages">Stages</TabsTrigger>
            </TabsList>

            {/* Details Tab */}
            <TabsContent value="details" className="flex-1 overflow-y-auto px-6 py-6 space-y-6 mt-0">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Pipeline Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., UCLan 2026"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sport</Label>
                  <Select value={sport} onValueChange={(v) => setSport(v as 'football' | 'basketball')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sport" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="football">Football</SelectItem>
                      <SelectItem value="basketball">Basketball</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Programme</Label>
                  <Select value={programmeId || 'none'} onValueChange={(v) => setProgrammeId(v === 'none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Link to a programme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No programme</SelectItem>
                      {programmes.map((programme) => (
                        <SelectItem key={programme.id} value={programme.id}>
                          {programme.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Active</Label>
                    <p className="text-xs text-muted-foreground">
                      Inactive pipelines are hidden from the selector
                    </p>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              </div>

              <div className="pt-4 border-t space-y-3">
                <Button
                  onClick={handleSaveDetails}
                  disabled={!name.trim() || updatePipeline.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {updatePipeline.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setShowDeletePipelineDialog(true)}
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Pipeline
                </Button>
              </div>
            </TabsContent>

            {/* Stages Tab */}
            <TabsContent value="stages" className="flex-1 overflow-y-auto px-6 py-6 space-y-4 mt-0">
              {stagesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Existing Stages */}
                  <div className="space-y-2">
                    {sortedStages.map((stage, index) => (
                      <div
                        key={stage.id}
                        className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                      >
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => handleMoveStage(stage.id, 'up')}
                            disabled={index === 0 || reorderStages.isPending}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => handleMoveStage(stage.id, 'down')}
                            disabled={index === sortedStages.length - 1 || reorderStages.isPending}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <div
                          className="w-4 h-4 rounded-full shrink-0"
                          style={{ backgroundColor: stage.color }}
                        />
                        
                        {editingStage?.id === stage.id ? (
                          <div className="flex-1 space-y-2">
                            <Input
                              value={editingStage.name}
                              onChange={(e) => setEditingStage({ ...editingStage, name: e.target.value })}
                              className="h-8"
                            />
                            <div className="flex gap-2">
                              <Select
                                value={editingStage.stage_type}
                                onValueChange={(v) => setEditingStage({ ...editingStage, stage_type: v as PipelineStage['stage_type'] })}
                              >
                                <SelectTrigger className="h-8 flex-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STAGE_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                      {type.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select
                                value={editingStage.color}
                                onValueChange={(v) => setEditingStage({ ...editingStage, color: v })}
                              >
                                <SelectTrigger className="h-8 w-20">
                                  <div
                                    className="w-4 h-4 rounded-full"
                                    style={{ backgroundColor: editingStage.color }}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {STAGE_COLORS.map((color) => (
                                    <SelectItem key={color} value={color}>
                                      <div className="flex items-center gap-2">
                                        <div
                                          className="w-4 h-4 rounded-full"
                                          style={{ backgroundColor: color }}
                                        />
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={handleUpdateStage}
                                disabled={updateStage.isPending}
                                className="h-7"
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingStage(null)}
                                className="h-7"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{stage.name}</p>
                              <p className="text-xs text-muted-foreground">{stage.stage_type}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditingStage(stage)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setStageToDelete(stage)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add Stage Form */}
                  {isAddingStage ? (
                    <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg space-y-3">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Add New Stage</h4>
                      <Input
                        value={newStageName}
                        onChange={(e) => setNewStageName(e.target.value)}
                        placeholder="Stage name"
                      />
                      <div className="flex gap-2">
                        <Select
                          value={newStageType}
                          onValueChange={(v) => setNewStageType(v as PipelineStage['stage_type'])}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Stage type" />
                          </SelectTrigger>
                          <SelectContent>
                            {STAGE_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={newStageColor}
                          onValueChange={setNewStageColor}
                        >
                          <SelectTrigger className="w-20">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: newStageColor }}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {STAGE_COLORS.map((color) => (
                              <SelectItem key={color} value={color}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-4 h-4 rounded-full"
                                    style={{ backgroundColor: color }}
                                  />
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleAddStage}
                          disabled={!newStageName.trim() || createStage.isPending}
                          className="flex-1"
                        >
                          {createStage.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Add Stage'
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsAddingStage(false)
                            setNewStageName('')
                            setNewStageType('lead')
                            setNewStageColor('#3b82f6')
                          }}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setIsAddingStage(true)}
                      className="w-full"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Stage
                    </Button>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Delete Pipeline Confirmation */}
      <AlertDialog open={showDeletePipelineDialog} onOpenChange={setShowDeletePipelineDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pipeline?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{pipeline.name}&quot;? This will also delete all stages.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePipeline}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletePipeline.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Stage Confirmation */}
      <AlertDialog open={!!stageToDelete} onOpenChange={() => setStageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stage?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{stageToDelete?.name}&quot;? 
              Deals in this stage will need to be moved first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStage}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteStage.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
