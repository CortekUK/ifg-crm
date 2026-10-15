'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePipelines } from '@/lib/hooks/usePipelines'
import { useThreadContact } from '@/lib/hooks/useMailbox'
import { useCreateDeal } from '@/lib/hooks/useCreateDeal'
import { useDealValueForPipeline } from '@/lib/hooks/useDealValueForPipeline'
import { resolveReplyLeadStageId } from '@/lib/forms/lead-routing'
import { resolveDealOwner } from '@/lib/deals/resolve-owner'
import { toast } from '@/lib/hooks/use-toast'

interface ComposeDealPromptProps {
  contactId: string
  contactName: string
  userId: string
  /** Pre-selected when Compose already asked which pipeline this is about. */
  initialPipelineId?: string
  onDone: () => void
}

/**
 * Smart Deal for the Compose flow: you have just emailed a contact who is in
 * the CRM but has no deal, so offer to open one.
 *
 * The pipeline picker is the whole point — a deal without a pipeline is
 * meaningless, and guessing one would file a player into a programme nobody
 * chose.
 *
 * Stage: resolveReplyLeadStageId, the SAME helper the existing Smart Deal
 * path uses, which lands the deal in Contact Response rather than Initial
 * Lead. That is deliberate. Initial Lead is where the Initial Contact
 * automation hangs, so creating the deal there would enrol a player in the
 * cold 3-email outreach seconds after a recruiter wrote to them personally —
 * the exact trap QA-18 was raised for. They have been contacted; Contact
 * Response is the honest column.
 */
export function ComposeDealPrompt({
  contactId,
  contactName,
  userId,
  initialPipelineId,
  onDone,
}: ComposeDealPromptProps) {
  const [pipelineId, setPipelineId] = useState<string>(initialPipelineId ?? '')
  const [isCreating, setIsCreating] = useState(false)

  const { data: pipelines = [] } = usePipelines()
  // What they are already in. Offering a pipeline that already holds a deal
  // for this person is how you end up with the same player twice in one
  // pipeline and two recruiters working them.
  const { data: contactDetail } = useThreadContact(contactId)
  const existing = contactDetail?.deals ?? []
  const existingPipelines = new Set(existing.map((d) => d.pipeline).filter(Boolean) as string[])
  const createDeal = useCreateDeal()
  const dealValueForPipeline = useDealValueForPipeline()

  const handleCreate = async () => {
    if (!pipelineId) return
    setIsCreating(true)
    try {
      const supabase = createClient()
      const stageId = await resolveReplyLeadStageId(supabase, pipelineId)
      if (!stageId) throw new Error('That pipeline has no stage to put the deal in.')

      const pipelineName = pipelines.find((p) => p.id === pipelineId)?.name ?? 'Pipeline'

      // NOT simply the person who pressed the button. A database trigger
      // refuses any deal owned by the shared superadmin account, which is
      // exactly the account staff use for admin work — so assigning the
      // acting user failed with a constraint error and the screen could only
      // say "Could not create the deal".
      const { ownerId } = await resolveDealOwner(supabase, pipelineId, userId)

      await createDeal.mutateAsync({
        contactId,
        pipelineId,
        stageId,
        ownerId: ownerId as string,
        dealValue: dealValueForPipeline(pipelineId),
        title: `${contactName} - ${pipelineName}`,
        notes: 'Created from an email sent in the CRM mailbox',
        source: 'smart_process',
      })

      toast({ title: 'Deal created', description: `${contactName} added to ${pipelineName}.` })
      onDone()
    } catch (error) {
      // Show what the database actually said. "Please try again" sent
      // people round the same failing loop with no idea what was wrong.
      const detail =
        error instanceof Error ? error.message :
        typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) :
        'Please try again.'
      toast({ title: 'Could not create the deal', description: detail, variant: 'destructive' })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onDone()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {existing.length > 0 ? `Add ${contactName} to another pipeline?` : `Create a deal for ${contactName}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {existing.length > 0
              ? `${contactName} is already in a pipeline. Choose another one to open a second deal, or close this.`
              : `${contactName} is in the CRM but has no deal yet — choose a pipeline to open one, or skip and do it later.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          {existing.length > 0 && (
            <div className="rounded-md border bg-muted/40 p-2.5 text-sm">
              <p className="font-medium">Already in a pipeline</p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {existing.map((d) => (
                  <li key={d.id}>
                    {d.pipeline ?? 'Pipeline'}
                    {d.stage ? ` · ${d.stage}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Label htmlFor="compose-deal-pipeline">Pipeline</Label>
          <Select value={pipelineId} onValueChange={setPipelineId}>
            <SelectTrigger id="compose-deal-pipeline">
              <SelectValue placeholder="Choose a pipeline" />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map((pipeline) => {
                const already = existingPipelines.has(pipeline.name)
                return (
                  <SelectItem key={pipeline.id} value={pipeline.id} disabled={already}>
                    {pipeline.name}
                    {already ? ' — already in this one' : ''}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={onDone} disabled={isCreating}>
            Not now
          </Button>
          <Button onClick={handleCreate} disabled={!pipelineId || isCreating}>
            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create deal
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
