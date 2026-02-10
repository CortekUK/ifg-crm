'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Briefcase,
  Loader2,
  Check,
  Mail,
  Phone,
  Users,
  UserCheck,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/hooks/use-toast'
import { usePipelines } from '@/lib/hooks/usePipelines'
import { usePipelineAssignedUsers } from '@/lib/hooks/usePipelineAssignedUsers'
import { useManualRoundRobin } from '@/lib/hooks/useManualRoundRobin'
import { useCreateDeal } from '@/lib/hooks/useCreateDeal'
import type { EmailReply } from '@/lib/types/email'
import type { SMSMessage } from '@/lib/types/sms'

interface SmartDealModalProps {
  isOpen: boolean
  onClose: () => void
  type: 'email' | 'sms'
  replies?: EmailReply[]
  messages?: SMSMessage[]
  userId: string
}

interface DealItem {
  id: string
  contactId: string
  contactName: string
  contactInitials: string
  pipelineId: string
  preview: string
  intent: string | null
  campaignId: string | null
  campaignName: string | null
}

export function SmartDealModal({
  isOpen,
  onClose,
  type,
  replies = [],
  messages = [],
  userId,
}: SmartDealModalProps) {
  const [isApplying, setIsApplying] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [assignmentMode, setAssignmentMode] = useState<'round_robin' | 'manual'>('round_robin')
  const [manualAssigneeId, setManualAssigneeId] = useState<string | null>(null)

  const supabase = createClient()
  const queryClient = useQueryClient()
  const { data: pipelines = [] } = usePipelines()
  const roundRobin = useManualRoundRobin()
  const createDeal = useCreateDeal()

  // Build deal items from matched replies
  const { eligible, ineligible } = useMemo(() => {
    const eligibleItems: DealItem[] = []
    const ineligibleItems: DealItem[] = []

    if (type === 'email') {
      replies.forEach((r) => {
        if (r.contact_id && r.pipeline_id) {
          const contact = r.contact
          const firstName = contact?.first_name || ''
          const lastName = contact?.last_name || ''
          const name = `${firstName} ${lastName}`.trim() || r.from_name || r.from_email
          const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || '??'
          eligibleItems.push({
            id: r.id,
            contactId: r.contact_id,
            contactName: name,
            contactInitials: initials,
            pipelineId: r.pipeline_id,
            preview: r.body_preview || r.subject || '',
            intent: r.ai_intent,
            campaignId: r.campaign_id,
            campaignName: r.campaign?.name || null,
          })
        } else if (r.contact_id && !r.pipeline_id) {
          const contact = r.contact
          const firstName = contact?.first_name || ''
          const lastName = contact?.last_name || ''
          const name = `${firstName} ${lastName}`.trim() || r.from_name || r.from_email
          ineligibleItems.push({
            id: r.id,
            contactId: r.contact_id,
            contactName: name,
            contactInitials: `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || '??',
            pipelineId: '',
            preview: r.body_preview || r.subject || '',
            intent: r.ai_intent,
            campaignId: r.campaign_id,
            campaignName: r.campaign?.name || null,
          })
        }
      })
    } else {
      messages.forEach((m) => {
        if (m.contact_id && m.pipeline_id) {
          const contact = m.contact
          const firstName = contact?.first_name || ''
          const lastName = contact?.last_name || ''
          const name = `${firstName} ${lastName}`.trim() || m.phone_number
          const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || '??'
          eligibleItems.push({
            id: m.id,
            contactId: m.contact_id,
            contactName: name,
            contactInitials: initials,
            pipelineId: m.pipeline_id,
            preview: m.content || '',
            intent: m.ai_intent,
            campaignId: m.campaign_id,
            campaignName: null,
          })
        } else if (m.contact_id && !m.pipeline_id) {
          const contact = m.contact
          const firstName = contact?.first_name || ''
          const lastName = contact?.last_name || ''
          const name = `${firstName} ${lastName}`.trim() || m.phone_number
          ineligibleItems.push({
            id: m.id,
            contactId: m.contact_id,
            contactName: name,
            contactInitials: `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || '??',
            pipelineId: '',
            preview: m.content || '',
            intent: m.ai_intent,
            campaignId: m.campaign_id,
            campaignName: null,
          })
        }
      })
    }

    return { eligible: eligibleItems, ineligible: ineligibleItems }
  }, [type, replies, messages])

  // Pre-select positive/question intent on open, reset on close
  useEffect(() => {
    if (!isOpen) {
      setSelectedIds(new Set())
      setAssignmentMode('round_robin')
      setManualAssigneeId(null)
      return
    }
    // Build eligible items inline to avoid dependency on the memoized array
    const items: { id: string; intent: string | null }[] = []
    if (type === 'email') {
      replies.forEach((r) => {
        if (r.contact_id && r.pipeline_id) items.push({ id: r.id, intent: r.ai_intent })
      })
    } else {
      messages.forEach((m) => {
        if (m.contact_id && m.pipeline_id) items.push({ id: m.id, intent: m.ai_intent })
      })
    }
    if (items.length > 0) {
      const preSelected = new Set(
        items
          .filter((item) => item.intent === 'positive' || item.intent === 'question')
          .map((item) => item.id)
      )
      setSelectedIds(preSelected.size > 0 ? preSelected : new Set(items.map((item) => item.id)))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Get unique pipeline IDs from selected items
  const activePipelineIds = useMemo(() => {
    const ids = new Set<string>()
    eligible.forEach((item) => {
      if (selectedIds.has(item.id)) {
        ids.add(item.pipelineId)
      }
    })
    return Array.from(ids)
  }, [eligible, selectedIds])

  const firstActivePipelineId = activePipelineIds[0] || null
  const { data: assignedUsers = [] } = usePipelineAssignedUsers(firstActivePipelineId)

  // Pipeline breakdown for stats
  const pipelineBreakdown = useMemo(() => {
    const counts = new Map<string, number>()
    eligible.forEach((item) => {
      if (selectedIds.has(item.id)) {
        counts.set(item.pipelineId, (counts.get(item.pipelineId) || 0) + 1)
      }
    })
    return Array.from(counts.entries()).map(([pipelineId, count]) => ({
      pipelineId,
      name: pipelines.find((p) => p.id === pipelineId)?.name || 'Unknown',
      count,
    }))
  }, [eligible, selectedIds, pipelines])

  const selectedCount = eligible.filter((item) => selectedIds.has(item.id)).length

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(eligible.map((item) => item.id)))
  }

  const selectNone = () => {
    setSelectedIds(new Set())
  }

  const getPipelineName = (pipelineId: string) => {
    return pipelines.find((p) => p.id === pipelineId)?.name || 'Unknown'
  }

  const getIntentBadge = (intent: string | null) => {
    switch (intent) {
      case 'positive':
        return <Badge className="bg-green-500 text-white text-xs px-1.5 py-0">Positive</Badge>
      case 'question':
        return <Badge className="bg-blue-500 text-white text-xs px-1.5 py-0">Question</Badge>
      case 'negative':
        return <Badge className="bg-red-500 text-white text-xs px-1.5 py-0">Negative</Badge>
      case 'neutral':
        return <Badge className="bg-slate-500 text-white text-xs px-1.5 py-0">Neutral</Badge>
      default:
        return null
    }
  }

  const createDeals = async () => {
    setIsApplying(true)

    const selectedItems = eligible.filter((item) => selectedIds.has(item.id))
    let dealCount = 0
    let skippedCount = 0
    let errorCount = 0

    try {
      for (const item of selectedItems) {
        try {
          // Check if a deal already exists for this contact + pipeline
          const { count: existingCount } = await supabase
            .from('deals')
            .select('id', { count: 'exact', head: true })
            .eq('contact_id', item.contactId)
            .eq('pipeline_id', item.pipelineId)

          if (existingCount && existingCount > 0) {
            // Deal already exists — still move reply out of Matched tab
            const replyTable = type === 'email' ? 'email_replies' : 'sms_messages'
            await supabase
              .from(replyTable)
              .update({ match_status: 'deal_created' })
              .eq('id', item.id)
            skippedCount++
            continue
          }

          // Get first stage for this pipeline
          const { data: firstStage, error: stageError } = await supabase
            .from('pipeline_stages')
            .select('id')
            .eq('pipeline_id', item.pipelineId)
            .order('display_order', { ascending: true })
            .limit(1)
            .single()

          if (stageError || !firstStage) {
            console.error('Could not find first stage for pipeline:', stageError)
            throw new Error('Could not find first stage for pipeline')
          }

          // Determine assignee
          let assigneeId: string

          if (assignmentMode === 'manual' && manualAssigneeId) {
            assigneeId = manualAssigneeId
          } else {
            // Round-robin assignment
            const { data: pipelineUsers } = await supabase
              .from('profiles')
              .select('id')
              .contains('pipeline_assignments', [item.pipelineId])
              .eq('is_active', true)

            const userIds = pipelineUsers?.map((u) => u.id) || []

            if (userIds.length === 0) {
              assigneeId = userId
            } else {
              assigneeId = await roundRobin.mutateAsync({
                pipelineId: item.pipelineId,
                userIds,
              })
            }
          }

          // Get pipeline name for deal title
          const pipelineName = getPipelineName(item.pipelineId)

          // Create the deal
          await createDeal.mutateAsync({
            contactId: item.contactId,
            pipelineId: item.pipelineId,
            stageId: firstStage.id,
            ownerId: assigneeId,
            dealValue: 0,
            title: `${item.contactName} - ${pipelineName}`,
            notes: `Created from campaign reply via Smart Deal`,
            source: 'smart_process',
            campaignId: item.campaignId || undefined,
            campaignName: item.campaignName || undefined,
          })

          // Move reply out of Matched tab by updating match_status
          const replyTable = type === 'email' ? 'email_replies' : 'sms_messages'
          await supabase
            .from(replyTable)
            .update({ match_status: 'deal_created' })
            .eq('id', item.id)

          dealCount++
        } catch (dealError) {
          console.error('Error creating deal:', dealError)
          errorCount++
        }
      }

      // Invalidate queries
      if (type === 'email') {
        queryClient.invalidateQueries({ queryKey: ['email-replies'] })
        queryClient.invalidateQueries({ queryKey: ['email-reply-counts'] })
      } else {
        queryClient.invalidateQueries({ queryKey: ['sms-messages'] })
        queryClient.invalidateQueries({ queryKey: ['sms-message-counts'] })
      }
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })

      const parts = []
      if (dealCount > 0) parts.push(`${dealCount} deal${dealCount === 1 ? '' : 's'} created`)
      if (skippedCount > 0) parts.push(`${skippedCount} already had deals`)
      if (errorCount > 0) parts.push(`${errorCount} errors`)

      toast({
        title: 'Smart Deal Complete',
        description: parts.join(', ') + '.',
      })

      onClose()
    } catch (error) {
      toast({
        title: 'Error creating deals',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
              <Briefcase className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <DialogTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
                Smart Deal
              </DialogTitle>
              <DialogDescription>
                Create deals from matched {type === 'email' ? 'email replies' : 'SMS messages'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {eligible.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-4">
            <Info className="h-10 w-10 text-slate-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              No eligible {type === 'email' ? 'replies' : 'messages'}
            </p>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Selected {type === 'email' ? 'replies' : 'messages'} must have a matched contact and an associated pipeline to create deals.
            </p>
          </div>
        ) : (
          <>
            {/* Stats & Selection Bar */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs">
                <span className="font-semibold text-foreground text-sm">{eligible.length} Eligible</span>
                <span className="h-3.5 w-px bg-slate-300 dark:bg-slate-600" />
                {pipelineBreakdown.map((pb) => (
                  <span key={pb.pipelineId} className="text-purple-600 dark:text-purple-400 font-medium">{pb.count} {pb.name}</span>
                ))}
                {ineligible.length > 0 && (
                  <span className="text-muted-foreground font-medium">{ineligible.length} No Pipeline</span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="outline" size="sm" onClick={selectAll} className="text-xs h-7">
                  All
                </Button>
                <Button variant="ghost" size="sm" onClick={selectNone} className="text-xs h-7 text-muted-foreground">
                  Clear
                </Button>
              </div>
            </div>

            {/* Assignment Mode Bar */}
            {selectedCount > 0 && (
              <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-800 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                  <span className="font-medium text-emerald-700 dark:text-emerald-300">
                    Deal Assignment:
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={assignmentMode === 'round_robin' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAssignmentMode('round_robin')}
                    className={cn(
                      'h-7 text-xs',
                      assignmentMode === 'round_robin' && 'bg-emerald-700 hover:bg-emerald-800'
                    )}
                  >
                    <Users className="h-3 w-3 mr-1" />
                    Round-Robin
                  </Button>
                  <Button
                    variant={assignmentMode === 'manual' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAssignmentMode('manual')}
                    className={cn(
                      'h-7 text-xs',
                      assignmentMode === 'manual' && 'bg-emerald-700 hover:bg-emerald-800'
                    )}
                  >
                    <UserCheck className="h-3 w-3 mr-1" />
                    Manual
                  </Button>
                  {assignmentMode === 'manual' && (
                    <Select
                      value={manualAssigneeId || ''}
                      onValueChange={(value) => setManualAssigneeId(value || null)}
                    >
                      <SelectTrigger className="h-7 w-40 text-xs">
                        <SelectValue placeholder="Select user..." />
                      </SelectTrigger>
                      <SelectContent>
                        {assignedUsers.length === 0 ? (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            No users assigned to this pipeline
                          </div>
                        ) : (
                          assignedUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.full_name || user.email}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            )}

            {/* Results List */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-4 py-3 space-y-2">
                {eligible.map((item) => {
                  const isSelected = selectedIds.has(item.id)
                  const pipelineName = getPipelineName(item.pipelineId)

                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleSelection(item.id)}
                      className={cn(
                        'p-3 rounded-lg border-2 transition-all cursor-pointer',
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 dark:border-emerald-600'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      )}
                    >
                      {/* Row 1: checkbox, avatar, name, badges */}
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelection(item.id)}
                          className="shrink-0 data-[state=checked]:bg-emerald-700 data-[state=checked]:border-emerald-700"
                        />
                        <Avatar className="h-6 w-6 shrink-0 border border-emerald-200 dark:border-emerald-800">
                          <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                            {item.contactInitials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm text-gray-900 dark:text-white">
                          {item.contactName}
                        </span>
                        {getIntentBadge(item.intent)}
                        <Badge
                          variant="outline"
                          className="text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700"
                        >
                          {pipelineName}
                        </Badge>
                        {item.campaignName && (
                          <span className="text-xs text-muted-foreground">
                            {item.campaignName}
                          </span>
                        )}
                      </div>
                      {/* Row 2: reply preview */}
                      <p className="text-xs text-muted-foreground mt-1 pl-10 line-clamp-2">
                        {type === 'email' ? <Mail className="inline h-3 w-3 text-blue-500 mr-1 -mt-0.5" /> : <Phone className="inline h-3 w-3 text-purple-500 mr-1 -mt-0.5" />}
                        {item.preview}
                      </p>
                    </div>
                  )
                })}

                {/* Ineligible items info section */}
                {ineligible.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <Info className="h-4 w-4 text-slate-400" />
                      <span className="text-xs font-medium text-muted-foreground">
                        {ineligible.length} {type === 'email' ? 'replies' : 'messages'} without a pipeline (no deal can be created)
                      </span>
                    </div>
                    {ineligible.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 opacity-50"
                      >
                        <div className="w-4 shrink-0" />
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-semibold">
                            {item.contactInitials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                            {item.contactName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.preview}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">No pipeline</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Footer */}
            <DialogFooter className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3 text-xs">
                  {selectedCount > 0 ? (
                    <span className="font-semibold text-foreground text-sm">{selectedCount} {selectedCount === 1 ? 'Deal' : 'Deals'} to Create</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Select items to create deals</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={createDeals}
                    disabled={selectedCount === 0 || isApplying || (assignmentMode === 'manual' && !manualAssigneeId)}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white min-w-[140px]"
                  >
                    {isApplying ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Create {selectedCount} {selectedCount === 1 ? 'Deal' : 'Deals'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
