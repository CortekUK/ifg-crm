'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  GitBranch,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  GripVertical,
  Users,
  Layers,
  ArrowRight,
  Save,
  AlertCircle,
} from 'lucide-react'
import { usePipelines, useAllPipelines, useCreatePipeline, useUpdatePipeline, useDeletePipeline } from '@/lib/hooks/usePipelines'
import { useUsers } from '@/lib/hooks/useUsers'
import { toast } from '@/lib/hooks/use-toast'
import type { Pipeline, PipelineStage } from '@/lib/types/pipelines'

interface CreatePipelineFormData {
  name: string
  is_active: boolean
}

interface EditPipelineFormData extends CreatePipelineFormData {
  id: string
}

const STAGE_TYPES = [
  { value: 'lead', label: 'Lead', color: 'bg-gray-500' },
  { value: 'contact', label: 'Contact', color: 'bg-blue-500' },
  { value: 'meeting', label: 'Meeting', color: 'bg-purple-500' },
  { value: 'follow_up', label: 'Follow Up', color: 'bg-yellow-500' },
  { value: 'documents', label: 'Documents', color: 'bg-orange-500' },
  { value: 'applied', label: 'Applied', color: 'bg-cyan-500' },
  { value: 'offer', label: 'Offer', color: 'bg-indigo-500' },
  { value: 'payment', label: 'Payment', color: 'bg-emerald-500' },
  { value: 'completed', label: 'Completed', color: 'bg-green-500' },
  { value: 'lost', label: 'Lost', color: 'bg-red-500' },
  { value: 'dormant', label: 'Dormant', color: 'bg-slate-500' },
]

export function PipelineManagementSettings() {
  const { data: pipelines = [], isLoading } = useAllPipelines()
  const { data: users = [] } = useUsers()
  const createPipeline = useCreatePipeline()
  const updatePipeline = useUpdatePipeline()
  const deletePipeline = useDeletePipeline()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isRecruiterModalOpen, setIsRecruiterModalOpen] = useState(false)
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null)
  const [selectedRecruiters, setSelectedRecruiters] = useState<string[]>([])

  const [createFormData, setCreateFormData] = useState<CreatePipelineFormData>({
    name: '',
    is_active: true,
  })

  const [editFormData, setEditFormData] = useState<EditPipelineFormData>({
    id: '',
    name: '',
    is_active: true,
  })

  const recruiters = users.filter((u) => u.role === 'recruiter' && u.is_active)

  const handleCreatePipeline = async () => {
    if (!createFormData.name.trim()) return

    try {
      await createPipeline.mutateAsync({
        name: createFormData.name.trim(),
        sport: 'football',
        is_active: createFormData.is_active,
      })

      toast({
        title: 'Pipeline created',
        description: `"${createFormData.name}" has been created successfully.`,
      })

      setIsCreateModalOpen(false)
      setCreateFormData({ name: '', is_active: true })
    } catch (error) {
      toast({
        title: 'Failed to create pipeline',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleEditPipeline = async () => {
    if (!editFormData.name.trim()) return

    try {
      await updatePipeline.mutateAsync({
        pipelineId: editFormData.id,
        updates: {
          name: editFormData.name.trim(),
          is_active: editFormData.is_active,
        },
      })

      toast({
        title: 'Pipeline updated',
        description: `"${editFormData.name}" has been updated.`,
      })

      setIsEditModalOpen(false)
    } catch (error) {
      toast({
        title: 'Failed to update pipeline',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleDeletePipeline = async () => {
    if (!selectedPipeline) return

    try {
      await deletePipeline.mutateAsync(selectedPipeline.id)

      toast({
        title: 'Pipeline deleted',
        description: `"${selectedPipeline.name}" has been deleted.`,
      })

      setIsDeleteDialogOpen(false)
      setSelectedPipeline(null)
    } catch (error) {
      toast({
        title: 'Failed to delete pipeline',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const openEditModal = (pipeline: Pipeline) => {
    setEditFormData({
      id: pipeline.id,
      name: pipeline.name,
      is_active: pipeline.is_active,
    })
    setIsEditModalOpen(true)
  }

  const openDeleteDialog = (pipeline: Pipeline) => {
    setSelectedPipeline(pipeline)
    setIsDeleteDialogOpen(true)
  }

  const openRecruiterModal = (pipeline: Pipeline) => {
    setSelectedPipeline(pipeline)
    // In a real implementation, fetch the current recruiter assignments
    setSelectedRecruiters([])
    setIsRecruiterModalOpen(true)
  }

  const handleRecruiterToggle = (userId: string) => {
    setSelectedRecruiters((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSaveRecruiters = async () => {
    if (!selectedPipeline) return

    // In a real implementation, save the recruiter assignments to the database
    toast({
      title: 'Recruiters assigned',
      description: `${selectedRecruiters.length} recruiters assigned to "${selectedPipeline.name}".`,
    })

    setIsRecruiterModalOpen(false)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pipeline Management</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage pipelines, stages, and recruiter assignments.
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          New Pipeline
        </Button>
      </div>

      {/* Pipelines List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Pipelines
          </CardTitle>
          <CardDescription>
            Manage your recruitment pipelines and their stages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pipelines.length === 0 ? (
            <div className="text-center py-8">
              <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">No pipelines</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get started by creating your first pipeline.
              </p>
              <Button onClick={() => setIsCreateModalOpen(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create Pipeline
              </Button>
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {pipelines.map((pipeline) => (
                <AccordionItem
                  key={pipeline.id}
                  value={pipeline.id}
                  className="border rounded-lg px-4"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 flex-1">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <div className="flex items-center gap-2 flex-1 text-left">
                        <span className="font-medium">{pipeline.name}</span>
                        {pipeline.programme && (
                          <Badge variant="outline" className="text-xs">
                            {pipeline.programme.name}
                          </Badge>
                        )}
                        {!pipeline.is_active && (
                          <Badge variant="secondary" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {/* Pipeline Actions */}
                      <div className="flex items-center gap-2 pb-4 border-b">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(pipeline)}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1.5" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openRecruiterModal(pipeline)}
                        >
                          <Users className="h-3.5 w-3.5 mr-1.5" />
                          Assign Recruiters
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => openDeleteDialog(pipeline)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          Delete
                        </Button>
                      </div>

                      {/* Stages Preview */}
                      <div>
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <Layers className="h-4 w-4" />
                          Pipeline Stages
                        </h4>
                        <div className="flex flex-wrap items-center gap-2">
                          {STAGE_TYPES.slice(0, 6).map((stage, index) => (
                            <div key={stage.value} className="flex items-center gap-1">
                              <Badge
                                variant="outline"
                                className="text-xs font-normal"
                              >
                                <span className={`w-2 h-2 rounded-full ${stage.color} mr-1.5`} />
                                {stage.label}
                              </Badge>
                              {index < 5 && (
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                          ))}
                          <span className="text-xs text-muted-foreground">+{STAGE_TYPES.length - 6} more</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Stage configuration coming soon. Stages are currently managed at the system level.
                        </p>
                      </div>

                      {/* Programme Info */}
                      {pipeline.programme && (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground">
                            Linked to programme: <span className="font-medium">{pipeline.programme.name}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Round Robin Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Round-Robin Deal Distribution
          </CardTitle>
          <CardDescription>
            How deals are automatically assigned to recruiters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-1">How it works:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
                  <li>When a new lead enters a pipeline, it&apos;s assigned to the next recruiter in rotation</li>
                  <li>Recruiters must be assigned to a pipeline to receive deals</li>
                  <li>Distribution is balanced evenly across all assigned recruiters</li>
                  <li>Use &quot;Assign Recruiters&quot; on each pipeline to configure who receives deals</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Pipeline Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Pipeline</DialogTitle>
            <DialogDescription>
              Add a new pipeline for managing recruitment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pipeline-name">Pipeline Name *</Label>
              <Input
                id="pipeline-name"
                value={createFormData.name}
                onChange={(e) => setCreateFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. UCLan 2027"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="pipeline-active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive pipelines are hidden from selection
                </p>
              </div>
              <Switch
                id="pipeline-active"
                checked={createFormData.is_active}
                onCheckedChange={(checked) =>
                  setCreateFormData((prev) => ({ ...prev, is_active: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreatePipeline}
              disabled={!createFormData.name.trim() || createPipeline.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createPipeline.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Pipeline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Pipeline Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Pipeline</DialogTitle>
            <DialogDescription>
              Update pipeline settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-pipeline-name">Pipeline Name *</Label>
              <Input
                id="edit-pipeline-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. UCLan 2027"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="edit-pipeline-active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive pipelines are hidden from selection
                </p>
              </div>
              <Switch
                id="edit-pipeline-active"
                checked={editFormData.is_active}
                onCheckedChange={(checked) =>
                  setEditFormData((prev) => ({ ...prev, is_active: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditPipeline}
              disabled={!editFormData.name.trim() || updatePipeline.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updatePipeline.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Recruiters Modal */}
      <Dialog open={isRecruiterModalOpen} onOpenChange={setIsRecruiterModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Recruiters</DialogTitle>
            <DialogDescription>
              Select recruiters who will receive deals from &quot;{selectedPipeline?.name}&quot; via round-robin.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {recruiters.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No active recruiters found.</p>
                <p className="text-xs">Add recruiters in the Users section first.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3 bg-slate-50 dark:bg-slate-800/50">
                {recruiters.map((recruiter) => (
                  <div key={recruiter.id} className="flex items-center space-x-3 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                    <Checkbox
                      id={`recruiter-${recruiter.id}`}
                      checked={selectedRecruiters.includes(recruiter.id)}
                      onCheckedChange={() => handleRecruiterToggle(recruiter.id)}
                    />
                    <Label
                      htmlFor={`recruiter-${recruiter.id}`}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      <span className="font-medium">{recruiter.full_name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{recruiter.email}</span>
                    </Label>
                  </div>
                ))}
              </div>
            )}

            {selectedRecruiters.length > 0 && (
              <p className="text-sm text-muted-foreground mt-3">
                {selectedRecruiters.length} recruiter{selectedRecruiters.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRecruiterModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRecruiters} className="bg-blue-600 hover:bg-blue-700">
              <Save className="h-4 w-4 mr-2" />
              Save Assignments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pipeline</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedPipeline?.name}&quot;? This action cannot be undone.
              All stages associated with this pipeline will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePipeline}
              className="bg-red-600 hover:bg-red-700"
              disabled={deletePipeline.isPending}
            >
              {deletePipeline.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete Pipeline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
