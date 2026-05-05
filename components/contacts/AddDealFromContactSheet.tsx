'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
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
import { Loader2 } from 'lucide-react'
import { usePipelines } from '@/lib/hooks/usePipelines'
import { usePipelineStages } from '@/lib/hooks/usePipelineStages'
import { useCreateDeal } from '@/lib/hooks/useCreateDeal'
import { OwnerSelect } from '@/components/ui/owner-select'
import { toast } from '@/lib/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'

interface AddDealFromContactSheetProps {
  isOpen: boolean
  onClose: () => void
  contactId: string
  contactName: string
}

export function AddDealFromContactSheet({
  isOpen,
  onClose,
  contactId,
  contactName,
}: AddDealFromContactSheetProps) {
  const [pipelineId, setPipelineId] = useState<string>('')
  const [stageId, setStageId] = useState<string>('')
  const [ownerId, setOwnerId] = useState<string>('')
  const [dealValue, setDealValue] = useState<string>('15000')
  const [notes, setNotes] = useState<string>('')

  const { data: pipelines = [] } = usePipelines()
  const { data: stages = [] } = usePipelineStages(pipelineId || null)
  const createDeal = useCreateDeal()
  const queryClient = useQueryClient()

  // Reset form when sheet opens
  useEffect(() => {
    if (isOpen) {
      setPipelineId('')
      setStageId('')
      setOwnerId('')
      setDealValue('15000')
      setNotes('')
    }
  }, [isOpen])

  // Auto-select first stage when stages load
  useEffect(() => {
    if (stages.length > 0 && !stageId) {
      setStageId(stages[0].id)
    }
  }, [stages, stageId])

  // Reset stage when pipeline changes
  useEffect(() => {
    setStageId('')
  }, [pipelineId])

  const selectedPipeline = pipelines.find((p) => p.id === pipelineId)

  const handleSubmit = async () => {
    if (!pipelineId || !stageId || !ownerId) return

    const title = `${contactName} - ${selectedPipeline?.name || 'Deal'}`

    try {
      await createDeal.mutateAsync({
        contactId,
        pipelineId,
        stageId,
        ownerId,
        dealValue: Number(dealValue) || 0,
        title,
        notes: notes || undefined,
      })

      queryClient.invalidateQueries({ queryKey: ['contact-deals', contactId] })
      queryClient.invalidateQueries({ queryKey: ['player-deals', contactId] })

      toast({ title: 'Deal created', description: `"${title}" has been created.` })
      onClose()
    } catch {
      toast({ title: 'Error', description: 'Failed to create deal.', variant: 'destructive' })
    }
  }

  const canSubmit = pipelineId && stageId && ownerId && !createDeal.isPending

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle>Add Deal</SheetTitle>
          <SheetDescription>Create a new deal for {contactName}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {/* Pipeline */}
          <div className="space-y-2">
            <Label>Pipeline *</Label>
            <Select value={pipelineId} onValueChange={setPipelineId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select pipeline" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stage */}
          <div className="space-y-2">
            <Label>Stage *</Label>
            <Select
              value={stageId}
              onValueChange={setStageId}
              disabled={!pipelineId || stages.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={pipelineId ? 'Select stage' : 'Select a pipeline first'} />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Deal Owner */}
          <div className="space-y-2">
            <Label>Deal Owner *</Label>
            <OwnerSelect
              value={ownerId || null}
              onChange={(val) => setOwnerId(val || '')}
              placeholder="Select deal owner"
              className="w-full"
              recruitersOnly
            />
          </div>

          {/* Deal Value */}
          <div className="space-y-2">
            <Label>Deal Value</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
              <Input
                type="number"
                value={dealValue}
                onChange={(e) => setDealValue(e.target.value)}
                className="pl-7"
                min={0}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <SheetFooter className="border-t px-6 py-4 bg-slate-50 dark:bg-slate-800 shrink-0">
          <div className="flex gap-3 w-full">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {createDeal.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
              ) : (
                'Create Deal'
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
