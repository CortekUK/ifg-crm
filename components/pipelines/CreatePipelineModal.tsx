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
import { Loader2 } from 'lucide-react'
import { useCreatePipeline } from '@/lib/hooks/usePipelines'
import { useProgrammes } from '@/lib/hooks/useProgrammes'
import { toast } from '@/lib/hooks/use-toast'
import type { PipelineStage } from '@/lib/types/pipelines'

interface CreatePipelineModalProps {
  isOpen: boolean
  onClose: () => void
}

const DEFAULT_STAGES: Array<{
  name: string
  stage_type: PipelineStage['stage_type']
  color: string
  display_order: number
}> = [
  { name: 'Initial Lead', stage_type: 'lead', color: '#3b82f6', display_order: 0 },
  { name: 'Initial Contact', stage_type: 'contact', color: '#06b6d4', display_order: 1 },
  { name: 'Zoom Scheduled', stage_type: 'meeting', color: '#8b5cf6', display_order: 2 },
  { name: 'Follow Up', stage_type: 'follow_up', color: '#f59e0b', display_order: 3 },
  { name: 'Application', stage_type: 'applied', color: '#ec4899', display_order: 4 },
  { name: 'Documents Received', stage_type: 'documents', color: '#f97316', display_order: 5 },
  { name: 'Interview', stage_type: 'meeting', color: '#6366f1', display_order: 6 },
  { name: 'Conditional Offer', stage_type: 'offer', color: '#22c55e', display_order: 7 },
  { name: 'Invoice Sent', stage_type: 'payment', color: '#84cc16', display_order: 8 },
  { name: 'Deposit Paid', stage_type: 'payment', color: '#10b981', display_order: 9 },
  { name: 'Arrival', stage_type: 'completed', color: '#059669', display_order: 10 },
  { name: 'Lost', stage_type: 'lost', color: '#ef4444', display_order: 11 },
]

export function CreatePipelineModal({ isOpen, onClose }: CreatePipelineModalProps) {
  const [name, setName] = useState('')
  const [sport, setSport] = useState<'football' | 'basketball'>('football')
  const [programmeId, setProgrammeId] = useState<string>('')
  const [useDefaultStages, setUseDefaultStages] = useState(true)

  const { data: programmes = [] } = useProgrammes()
  const createPipeline = useCreatePipeline()

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('')
      setSport('football')
      setProgrammeId('')
      setUseDefaultStages(true)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a pipeline name.',
        variant: 'destructive',
      })
      return
    }

    try {
      await createPipeline.mutateAsync({
        name: name.trim(),
        sport,
        programme_id: programmeId || null,
        stages: useDefaultStages ? DEFAULT_STAGES : undefined,
      })

      toast({
        title: 'Pipeline created',
        description: `${name} has been created successfully.`,
      })

      onClose()
    } catch (error) {
      toast({
        title: 'Failed to create pipeline',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-md flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
            Create Pipeline
          </SheetTitle>
          <SheetDescription>
            Add a new recruitment pipeline to track deals.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {/* Pipeline Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Pipeline Details
              </h3>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Pipeline Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., UCLan 2026"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Sport <span className="text-red-500">*</span>
                </Label>
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
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Programme (Optional)
                </Label>
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
                <p className="text-xs text-muted-foreground">
                  Link this pipeline to a specific programme for reporting.
                </p>
              </div>
            </div>

            {/* Initial Stages */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Initial Stages
              </h3>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="useDefaultStages"
                  checked={useDefaultStages}
                  onChange={(e) => setUseDefaultStages(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-slate-600"
                />
                <Label htmlFor="useDefaultStages" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  Create with default stages
                </Label>
              </div>

              {useDefaultStages && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-2">
                  <p className="text-xs text-muted-foreground mb-3">
                    The following stages will be created:
                  </p>
                  <div className="space-y-2">
                    {DEFAULT_STAGES.map((stage, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: stage.color }}
                        />
                        <span className="text-sm text-slate-900 dark:text-white">{stage.name}</span>
                        <span className="text-xs text-muted-foreground">({stage.stage_type})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!useDefaultStages && (
                <p className="text-sm text-amber-600">
                  You can add stages after creating the pipeline via the settings.
                </p>
              )}
            </div>
          </div>

          <SheetFooter className="border-t px-6 py-4 bg-slate-50 dark:bg-slate-800 shrink-0">
            <div className="flex gap-3 w-full">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!name.trim() || createPipeline.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {createPipeline.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Pipeline'
                )}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
