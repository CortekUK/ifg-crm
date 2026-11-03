'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMoveDealToPipeline } from '@/lib/hooks/useDeals'
import { useDealValueForPipeline } from '@/lib/hooks/useDealValueForPipeline'
import { usePipelines } from '@/lib/hooks/usePipelines'
import { usePipelineStages } from '@/lib/hooks/usePipelineStages'
import { toast } from '@/lib/hooks/use-toast'

/**
 * Move a deal to another pipeline. Notes, history and the contact stay, because
 * the deal itself stays. The database does the work: see migration 270.
 */
export function MoveDealDialog({
  dealId,
  currentPipelineId,
  isOpen,
  onClose,
  onMoved,
}: {
  dealId: string
  currentPipelineId: string
  isOpen: boolean
  onClose: () => void
  onMoved: () => void
}) {
  const [pipelineId, setPipelineId] = useState('')
  const [chosenStageId, setChosenStageId] = useState('')
  const { data: pipelines = [] } = usePipelines()
  const { data: stages = [] } = usePipelineStages(pipelineId || null)
  const dealValueFor = useDealValueForPipeline()
  const moveDeal = useMoveDealToPipeline()

  // Initial Lead by default, because that is where each pipeline's chain starts.
  const stageId = chosenStageId || stages.find((s) => s.stage_type === 'lead')?.id || ''
  const stageName = stages.find((s) => s.id === stageId)?.name
  const pipelineName = pipelines.find((p) => p.id === pipelineId)?.name

  const handleMove = async () => {
    try {
      // The new programme's price, not the old one's. Left alone when the new
      // programme publishes no price.
      const value = dealValueFor(pipelineId)
      await moveDeal.mutateAsync({
        dealId,
        pipelineId,
        stageId,
        dealValue: value > 0 ? value : null,
      })
      toast({ title: 'Deal moved', description: `Now in ${pipelineName}, ${stageName}.` })
      onMoved()
    } catch (err) {
      toast({
        title: 'Could not move the deal',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move deal</DialogTitle>
          <DialogDescription>
            Notes, history and contact details stay on the deal. Its current automations stop,
            and it starts the new pipeline&apos;s automatic emails and triggers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Pipeline</Label>
            <Select
              value={pipelineId}
              onValueChange={(id) => {
                setPipelineId(id)
                setChosenStageId('')
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a pipeline" />
              </SelectTrigger>
              <SelectContent>
                {pipelines
                  .filter((p) => p.id !== currentPipelineId)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Stage</Label>
            <Select value={stageId} onValueChange={setChosenStageId} disabled={!pipelineId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a stage" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={moveDeal.isPending}>
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={!pipelineId || !stageId || moveDeal.isPending}>
            {moveDeal.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Move deal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
