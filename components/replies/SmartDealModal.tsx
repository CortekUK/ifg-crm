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
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/hooks/use-toast'
import { usePipelines } from '@/lib/hooks/usePipelines'
import { usePipelineAssignedUsers } from '@/lib/hooks/usePipelineAssignedUsers'
import { useManualRoundRobin } from '@/lib/hooks/useManualRoundRobin'
import { useCreateDeal } from '@/lib/hooks/useCreateDeal'
import { trimQuotedContent } from '@/lib/utils/trimQuotedContent'
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
  // Pipeline carried by the reply itself. May be empty when the contact
  // replied via a campaign without a pipeline link, or when the reply
  // was matched manually. The user can override via per-row picker or
  // bulk assignment in this case — see `pipelineOverrides`.
  originalPipelineId: string
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
  // Per-row pipeline overrides for items whose reply has no pipeline.
  // Keyed by item.id. The effective pipeline used for deal creation is
  // (override ?? originalPipelineId). Empty string means "still no
  // pipeline" — those items remain non-selectable.
  const [pipelineOverrides, setPipelineOverrides] = useState<Map<string, string>>(new Map())
  const [bulkPipelineId, setBulkPipelineId] = useState<string>('')
  // Set of "<contactId>|<pipelineId>" keys for which a deal already
  // exists. Lets us warn upfront ("3 of your selections already have a
  // deal in this pipeline — they'll be skipped") instead of letting
  // the user click Create and discovering it via toast afterwards.
  const [existingDealKeys, setExistingDealKeys] = useState<Set<string>>(new Set())

  const supabase = createClient()
  const queryClient = useQueryClient()
  const { data: pipelines = [] } = usePipelines()
  const roundRobin = useManualRoundRobin()
  const createDeal = useCreateDeal()

  // Every matched contact lands in one unified list — the modal lets the
  // user pick a pipeline for items that don't have one (from the reply
  // chain), so the previous split between "eligible" and "ineligible"
  // is now collapsed into a single list with empty originalPipelineId
  // for the previously-ineligible rows.
  const items = useMemo(() => {
    const out: DealItem[] = []
    if (type === 'email') {
      replies.forEach((r) => {
        if (!r.contact_id) return
        const contact = r.contact
        const firstName = contact?.first_name || ''
        const lastName = contact?.last_name || ''
        const name = `${firstName} ${lastName}`.trim() || r.from_name || r.from_email
        const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || '??'
        // Strip the quoted-thread tail ("On <date> <person> wrote: …")
        // so the modal shows just the contact's actual words. Matches
        // the same trim used in the Replies list and detail sheet.
        const cleaned = trimQuotedContent(r.body_preview || '') || r.body_preview || ''
        out.push({
          id: r.id,
          contactId: r.contact_id,
          contactName: name,
          contactInitials: initials,
          originalPipelineId: r.pipeline_id || '',
          preview: cleaned || r.subject || '',
          intent: r.ai_intent,
          campaignId: r.campaign_id,
          campaignName: r.campaign?.name || null,
        })
      })
    } else {
      messages.forEach((m) => {
        if (!m.contact_id) return
        const contact = m.contact
        const firstName = contact?.first_name || ''
        const lastName = contact?.last_name || ''
        const name = `${firstName} ${lastName}`.trim() || m.phone_number
        const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || '??'
        out.push({
          id: m.id,
          contactId: m.contact_id,
          contactName: name,
          contactInitials: initials,
          originalPipelineId: m.pipeline_id || '',
          preview: m.content || '',
          intent: m.ai_intent,
          campaignId: m.campaign_id,
          campaignName: null,
        })
      })
    }
    return out
  }, [type, replies, messages])

  // Effective pipeline for a row: the user's override if they picked
  // one, otherwise whatever came from the reply. Items where this is
  // empty are not selectable yet — the user has to assign a pipeline
  // first (per-row picker or bulk).
  const effectivePipelineId = (item: DealItem) =>
    pipelineOverrides.get(item.id) || item.originalPipelineId
  const isItemEligible = (item: DealItem) => effectivePipelineId(item) !== ''

  // Eligible == "has an effective pipeline"; ineligible == "still
  // missing one". Computed each render but cheap (just filters).
  const eligible = useMemo(
    () => items.filter(isItemEligible),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, pipelineOverrides],
  )
  const ineligible = useMemo(
    () => items.filter((it) => !isItemEligible(it)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, pipelineOverrides],
  )

  // Lookup which (contact, pipeline) pairs already have a deal so the
  // user gets a heads-up instead of finding out via toast after they
  // click Create. We re-run when the underlying contact/pipeline
  // signature changes — depending on the `eligible` array reference
  // would loop forever (the array is a fresh memo every render).
  // Every state update goes through a functional update that returns
  // the same reference when content is unchanged, so a noop set
  // doesn't trigger a re-render → no infinite loop.
  const eligibleSignature = useMemo(
    () =>
      eligible
        .map((it) => `${it.contactId}|${effectivePipelineId(it)}`)
        .sort()
        .join(','),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eligible, pipelineOverrides],
  )

  useEffect(() => {
    let cancelled = false
    if (!isOpen || eligible.length === 0) {
      setExistingDealKeys((prev) => (prev.size === 0 ? prev : new Set()))
      return
    }
    const contactIds = Array.from(new Set(eligible.map((it) => it.contactId)))
    const pipelineIds = Array.from(
      new Set(eligible.map((it) => effectivePipelineId(it)).filter(Boolean)),
    )
    if (contactIds.length === 0 || pipelineIds.length === 0) {
      setExistingDealKeys((prev) => (prev.size === 0 ? prev : new Set()))
      return
    }
    ;(async () => {
      const { data } = await supabase
        .from('deals')
        .select('contact_id, pipeline_id')
        .in('contact_id', contactIds)
        .in('pipeline_id', pipelineIds)
      if (cancelled) return
      const keys = new Set<string>()
      for (const d of data || []) {
        if (d.contact_id && d.pipeline_id) {
          keys.add(`${d.contact_id}|${d.pipeline_id}`)
        }
      }
      setExistingDealKeys((prev) => {
        if (prev.size !== keys.size) return keys
        for (const k of keys) {
          if (!prev.has(k)) return keys
        }
        return prev
      })
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, eligibleSignature])

  const hasExistingDeal = (item: DealItem) =>
    existingDealKeys.has(`${item.contactId}|${effectivePipelineId(item)}`)

  // Negative or unsubscribe replies are explicit "not interested"
  // signals — creating a deal off those would be working against the
  // contact's intent. Block them from selection entirely (same pattern
  // as already-has-deal). Neutral / question / positive / unknown all
  // remain selectable.
  const isNotInterested = (item: DealItem) =>
    item.intent === 'negative' || item.intent === 'unsubscribe'

  // Combined "this row can't be picked" gate, used everywhere selection
  // logic decides whether a row is interactable.
  const isBlocked = (item: DealItem) => hasExistingDeal(item) || isNotInterested(item)

  // Pre-select positive/question intent on open, reset on close.
  // Pre-selection only applies to items that already have a pipeline
  // from the reply — items the user has to assign manually start
  // unselected so picking the pipeline is an explicit action.
  useEffect(() => {
    if (!isOpen) {
      setSelectedIds(new Set())
      setAssignmentMode('round_robin')
      setManualAssigneeId(null)
      setPipelineOverrides(new Map())
      setBulkPipelineId('')
      setExistingDealKeys(new Set())
      return
    }
    const seedItems: { id: string; intent: string | null }[] = []
    if (type === 'email') {
      replies.forEach((r) => {
        if (r.contact_id && r.pipeline_id) seedItems.push({ id: r.id, intent: r.ai_intent })
      })
    } else {
      messages.forEach((m) => {
        if (m.contact_id && m.pipeline_id) seedItems.push({ id: m.id, intent: m.ai_intent })
      })
    }
    if (seedItems.length > 0) {
      // Pre-select positive + question only. Never pre-select
      // negative/unsubscribe (explicit "not interested") and avoid
      // the previous fallback that selected ALL items when no
      // positive/question existed — that auto-ticked negatives.
      const preSelected = new Set(
        seedItems
          .filter((item) => item.intent === 'positive' || item.intent === 'question')
          .map((item) => item.id)
      )
      setSelectedIds(preSelected)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Get unique effective pipeline IDs from selected items
  const activePipelineIds = useMemo(() => {
    const ids = new Set<string>()
    eligible.forEach((item) => {
      if (selectedIds.has(item.id)) {
        ids.add(effectivePipelineId(item))
      }
    })
    return Array.from(ids)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, selectedIds, pipelineOverrides])

  const firstActivePipelineId = activePipelineIds[0] || null
  const { data: assignedUsers = [] } = usePipelineAssignedUsers(firstActivePipelineId)

  // Pipeline breakdown for stats — uses effective pipeline so overrides
  // show up in the breakdown immediately.
  const pipelineBreakdown = useMemo(() => {
    const counts = new Map<string, number>()
    eligible.forEach((item) => {
      if (selectedIds.has(item.id)) {
        const pid = effectivePipelineId(item)
        counts.set(pid, (counts.get(pid) || 0) + 1)
      }
    })
    return Array.from(counts.entries()).map(([pipelineId, count]) => ({
      pipelineId,
      name: pipelines.find((p) => p.id === pipelineId)?.name || 'Unknown',
      count,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, selectedIds, pipelines, pipelineOverrides])

  const selectedCount = useMemo(
    () => eligible.filter((item) => selectedIds.has(item.id)).length,
    [eligible, selectedIds]
  )

  // Auto-deselect any items that turn out to be blocked — either
  // because they already have a deal in the chosen pipeline or
  // because their intent is "not interested". Both paths converge to
  // isBlocked().
  useEffect(() => {
    setSelectedIds((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const id of prev) {
        const item = items.find((it) => it.id === id)
        if (item && isBlocked(item)) {
          next.delete(id)
          changed = true
        }
      }
      return changed ? next : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingDealKeys, items, pipelineOverrides])

  const toggleSelection = (id: string) => {
    // Blocked items (already-has-deal or not-interested intent) are
    // non-selectable. The card UI disables the checkbox; this is the
    // safety net for any other entry point (clicking the row body).
    const item = items.find((it) => it.id === id)
    if (item && isBlocked(item)) return

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
    setSelectedIds(
      new Set(
        eligible.filter((item) => !isBlocked(item)).map((item) => item.id),
      ),
    )
  }

  // Per-row pipeline picker handler.
  const setPipelineFor = (itemId: string, pipelineId: string) => {
    setPipelineOverrides((prev) => {
      const next = new Map(prev)
      if (pipelineId) {
        next.set(itemId, pipelineId)
      } else {
        next.delete(itemId)
      }
      return next
    })
    // Auto-select once they assign a pipeline (saves an extra click) —
    // BUT skip auto-select if a deal already exists for this contact in
    // the chosen pipeline. The existingDealKeys effect will also catch
    // this, but guarding here avoids the flicker of select-then-deselect.
    if (pipelineId) {
      const item = items.find((it) => it.id === itemId)
      const key = item ? `${item.contactId}|${pipelineId}` : ''
      if (!existingDealKeys.has(key)) {
        setSelectedIds((prev) => new Set(prev).add(itemId))
      }
    }
  }

  // Bulk: assign the chosen pipeline to every row that currently has
  // none. Doesn't touch rows that already have a pipeline (from the
  // reply or from a previous override). Auto-select skips items that
  // would conflict with an existing deal — those rows stay visible
  // and tagged but unselectable.
  const applyBulkPipeline = () => {
    if (!bulkPipelineId) return
    setPipelineOverrides((prev) => {
      const next = new Map(prev)
      items.forEach((it) => {
        if (it.originalPipelineId === '' && !next.has(it.id)) {
          next.set(it.id, bulkPipelineId)
        }
      })
      return next
    })
    setSelectedIds((prev) => {
      const next = new Set(prev)
      items.forEach((it) => {
        if (it.originalPipelineId === '') {
          const key = `${it.contactId}|${bulkPipelineId}`
          if (!existingDealKeys.has(key)) {
            next.add(it.id)
          }
        }
      })
      return next
    })
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
        const pipelineIdForDeal = effectivePipelineId(item)
        if (!pipelineIdForDeal) {
          // Defensive: shouldn't happen because eligibility checks
          // effectivePipelineId already, but skip rather than crash.
          continue
        }
        try {
          // Check if a deal already exists for this contact + pipeline
          const { count: existingCount } = await supabase
            .from('deals')
            .select('id', { count: 'exact', head: true })
            .eq('contact_id', item.contactId)
            .eq('pipeline_id', pipelineIdForDeal)

          if (existingCount && existingCount > 0) {
            // Deal already exists — still move reply out of Matched tab.
            // Also stamp pipeline_id so the All tab reflects the right
            // pipeline column even when the user assigned it manually
            // via the modal's per-row picker.
            const replyTable = type === 'email' ? 'email_replies' : 'sms_messages'
            await supabase
              .from(replyTable)
              .update({ match_status: 'deal_created', pipeline_id: pipelineIdForDeal })
              .eq('id', item.id)
            skippedCount++
            continue
          }

          // Get first stage for this pipeline
          const { data: firstStage, error: stageError } = await supabase
            .from('pipeline_stages')
            .select('id')
            .eq('pipeline_id', pipelineIdForDeal)
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
              .contains('pipeline_assignments', [pipelineIdForDeal])
              .eq('is_active', true)
              .neq('email', 'superadmin@theinternationalfootballgroup.com')

            const userIds = pipelineUsers?.map((u) => u.id) || []

            if (userIds.length === 0) {
              assigneeId = userId
            } else {
              assigneeId = await roundRobin.mutateAsync({
                pipelineId: pipelineIdForDeal,
                userIds,
              })
            }
          }

          // Get pipeline name for deal title
          const pipelineName = getPipelineName(pipelineIdForDeal)

          // Create the deal
          await createDeal.mutateAsync({
            contactId: item.contactId,
            pipelineId: pipelineIdForDeal,
            stageId: firstStage.id,
            ownerId: assigneeId,
            dealValue: 0,
            title: `${item.contactName} - ${pipelineName}`,
            notes: `Created from campaign reply via Smart Deal`,
            source: 'smart_process',
            campaignId: item.campaignId || undefined,
            campaignName: item.campaignName || undefined,
          })

          // Move reply out of Matched tab by updating match_status.
          // Also persist the chosen pipeline_id so the All tab's
          // Pipeline column reflects what we actually used.
          const replyTable = type === 'email' ? 'email_replies' : 'sms_messages'
          await supabase
            .from(replyTable)
            .update({ match_status: 'deal_created', pipeline_id: pipelineIdForDeal })
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

        {/* Empty state only if there's nothing to act on at all — i.e.
            no matched contacts. Items that have a contact but no
            pipeline now show in the "needs a pipeline" section where
            the user assigns one and creates the deal. */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-4">
            <Info className="h-10 w-10 text-slate-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              No matched {type === 'email' ? 'replies' : 'messages'}
            </p>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Selected {type === 'email' ? 'replies' : 'messages'} must have a matched contact. Use Smart Match first to link them to contacts, then come back here to create deals.
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
                  const pipelineName = getPipelineName(effectivePipelineId(item))
                  const isOverridden = pipelineOverrides.has(item.id)
                  const alreadyHasDeal = hasExistingDeal(item)
                  const notInterested = isNotInterested(item)
                  const blocked = alreadyHasDeal || notInterested

                  return (
                    <div
                      key={item.id}
                      onClick={() => !blocked && toggleSelection(item.id)}
                      className={cn(
                        'p-3 rounded-lg border-2 transition-all',
                        blocked
                          ? 'bg-amber-50/60 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 opacity-70 cursor-not-allowed'
                          : isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 dark:border-emerald-600 cursor-pointer'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer'
                      )}
                    >
                      {/* Row 1: checkbox, avatar, name, badges */}
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={isSelected}
                          disabled={blocked}
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
                          {isOverridden && (
                            <span className="ml-1 text-[9px] uppercase opacity-60">manual</span>
                          )}
                        </Badge>
                        {alreadyHasDeal && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700"
                          >
                            Already has deal
                          </Badge>
                        )}
                        {notInterested && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-700"
                          >
                            Not interested — skipped
                          </Badge>
                        )}
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

                {/* No-pipeline section. Each row gets its own pipeline
                    picker; on selection the row jumps into the eligible
                    list above (auto-selected for convenience). A bulk
                    picker at the top of the section assigns the chosen
                    pipeline to every still-unassigned row in one click. */}
                {ineligible.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between gap-2 mb-3 px-1 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-slate-400" />
                        <span className="text-xs font-medium text-muted-foreground">
                          {ineligible.length} {type === 'email' ? 'replies' : 'messages'} need a pipeline
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select value={bulkPipelineId} onValueChange={setBulkPipelineId}>
                          <SelectTrigger className="h-8 w-44 text-xs">
                            <SelectValue placeholder="Bulk: pick pipeline…" />
                          </SelectTrigger>
                          <SelectContent>
                            {pipelines.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={applyBulkPipeline}
                          disabled={!bulkPipelineId}
                          className="h-8 text-xs"
                        >
                          Assign to all
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {ineligible.map((item) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-[auto_1fr_auto] items-center gap-3 p-3 rounded-lg border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10"
                        >
                          {/* Use a CSS grid (auto, 1fr, auto) so the
                              middle column truncates without pushing
                              the trailing pipeline picker off-screen.
                              The previous flex layout was letting the
                              long email preview blow out the row. */}
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-semibold">
                              {item.contactInitials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                              {item.contactName}
                            </p>
                            {item.campaignName && (
                              <p className="text-xs text-muted-foreground truncate">
                                {item.campaignName}
                              </p>
                            )}
                          </div>
                          <Select
                            value={pipelineOverrides.get(item.id) || ''}
                            onValueChange={(v) => setPipelineFor(item.id, v)}
                          >
                            <SelectTrigger className="h-8 w-48 text-xs">
                              <SelectValue placeholder="Pick pipeline…" />
                            </SelectTrigger>
                            <SelectContent>
                              {pipelines.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
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
