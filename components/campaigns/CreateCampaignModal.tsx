'use client'

// Campaign composer.
//
// A campaign is "this saved template, to this audience, now or later". Anything
// that isn't one of those four decisions has been removed:
//
//   * SMS — there is no SMS provider wired up, so offering the choice only
//     produced campaigns that could never send.
//   * Subject line and preview text — process-campaigns overwrites the subject
//     with the template's own (`template.subject || campaign.subject`), and
//     preview_text was stored but never put into the outgoing email. Both
//     fields looked authoritative and were not.
//   * Compose-from-scratch — templates already carry the branding, merge tags
//     and shared links; an ad-hoc textarea body bypassed all of it.

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TemplateSearchSelect } from '@/components/ui/template-search-select'
import { TemplatePreviewModal } from '@/components/templates/TemplatePreviewModal'
import { AudienceSelect, type AudienceOption } from '@/components/campaigns/AudienceSelect'
import {
  CalendarIcon,
  Loader2,
  Users,
  AlertTriangle,
  Eye,
  Info,
  Tag,
  Layers,
  ListChecks,
  Send,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateLong, formatNumber } from '@/lib/utils/format'
import { useQuery } from '@tanstack/react-query'
import {
  useCreateCampaign,
  useUpdateCampaign,
  useCampaignLists,
  useEmailTemplates,
  useSendCampaign,
} from '@/lib/hooks/useCampaigns'
import { usePipelines } from '@/lib/hooks/usePipelines'
import { createClient } from '@/lib/supabase/client'
import {
  useTags,
  useAllPipelineStages,
  useCalculateCombinedRecipients,
} from '@/lib/hooks/useCampaignRecipientSources'
import { toast } from '@/lib/hooks/use-toast'
import type { Campaign, CreateCampaignInput } from '@/lib/types/campaigns'
import type { Template } from '@/lib/types/templates'

interface CreateCampaignModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  editCampaign?: Campaign | null
}

// Players have profiles too (the player portal signs them in), so an
// unfiltered profiles query put prospects in the "Send as" list.
const STAFF_ROLES = ['super_admin', 'admin', 'recruiter']

interface StaffMember {
  id: string
  full_name: string | null
  email: string
  role: string
}

/** Midnight today — the date picker must allow scheduling later *today*. */
function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function CreateCampaignModal({
  isOpen,
  onClose,
  userId,
  editCampaign,
}: CreateCampaignModalProps) {
  const [name, setName] = useState('')
  const [sendAsUserId, setSendAsUserId] = useState<string>(userId)
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)

  const [selectedLists, setSelectedLists] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedStages, setSelectedStages] = useState<string[]>([])

  const [templateId, setTemplateId] = useState<string>('')

  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>()
  const [scheduledTime, setScheduledTime] = useState('09:00')
  // Wall-clock reading taken when the user last touched the schedule controls.
  // Render must stay pure, so the "that time has passed" hint compares against
  // this rather than calling Date.now() inline; handleSubmit re-checks live.
  const [scheduleCheckedAt, setScheduleCheckedAt] = useState(0)

  const [showPreview, setShowPreview] = useState(false)
  const [showSendConfirmation, setShowSendConfirmation] = useState(false)

  // Guards against re-initialising the form while the user is typing in it.
  const initializedForRef = useRef<string | null>(null)

  const { data: lists = [] } = useCampaignLists()
  const { data: pipelines = [] } = usePipelines()
  const { data: templates = [] } = useEmailTemplates()
  const { data: tags = [] } = useTags()
  const { data: allStages = [] } = useAllPipelineStages()
  const { data: recipientData, isLoading: recipientCountLoading } =
    useCalculateCombinedRecipients(selectedLists, selectedTags, selectedStages)

  const { data: teamMembers = [] } = useQuery<StaffMember[]>({
    queryKey: ['team-members-staff'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('is_active', true)
        .in('role', STAFF_ROLES)
        .order('full_name')
      if (error) throw error
      return data || []
    },
  })

  const createCampaign = useCreateCampaign()
  const updateCampaign = useUpdateCampaign()
  const sendCampaign = useSendCampaign()

  const isEditing = !!editCampaign

  // Seed the form from the campaign being edited, once per open. The ref guard
  // means this runs on open and never again while the user is typing, so the
  // cascading-render concern behind react-hooks/set-state-in-effect does not
  // apply — the alternative (remounting the form via `key`) would drop the
  // sheet's close animation.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isOpen) {
      initializedForRef.current = null
      return
    }

    const formKey = editCampaign?.id ?? 'new'
    if (initializedForRef.current === formKey) return
    initializedForRef.current = formKey

    if (editCampaign) {
      setName(editCampaign.name)
      setSendAsUserId(editCampaign.from_user_id || userId)
      setSelectedLists(editCampaign.recipient_list_ids || [])
      setSelectedTags(editCampaign.recipient_tag_ids || [])
      setSelectedStages(editCampaign.recipient_stage_ids || [])
      setTemplateId(editCampaign.email_template_id || '')
      setSelectedPipelineId(editCampaign.pipeline_id || null)

      if (editCampaign.scheduled_at) {
        const date = new Date(editCampaign.scheduled_at)
        setIsScheduled(true)
        setScheduledDate(date)
        setScheduledTime(
          `${date.getHours().toString().padStart(2, '0')}:${date
            .getMinutes()
            .toString()
            .padStart(2, '0')}`,
        )
      } else {
        setIsScheduled(false)
        setScheduledDate(undefined)
        setScheduledTime('09:00')
      }
    } else {
      setName('')
      setSendAsUserId(userId)
      setSelectedLists([])
      setSelectedTags([])
      setSelectedStages([])
      setTemplateId('')
      setSelectedPipelineId(null)
      setIsScheduled(false)
      setScheduledDate(undefined)
      setScheduledTime('09:00')
    }
  }, [isOpen, editCampaign, userId])
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) =>
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const listOptions: AudienceOption[] = useMemo(
    () => lists.map((l) => ({ id: l.id, name: l.name, count: l.contact_count })),
    [lists],
  )

  const tagOptions: AudienceOption[] = useMemo(
    () =>
      tags.map((t: { id: string; name: string; color?: string | null; contact_count?: number }) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        count: t.contact_count,
      })),
    [tags],
  )

  // Stages are grouped under their pipeline. When a pipeline is chosen for the
  // campaign we only offer that pipeline's stages, so the two settings can't
  // contradict each other.
  const stageOptions: AudienceOption[] = useMemo(() => {
    const byPipeline = new Map(pipelines.map((p) => [p.id, p.name]))
    return allStages
      .filter((s: { pipeline_id: string }) =>
        selectedPipelineId ? s.pipeline_id === selectedPipelineId : true,
      )
      .map(
        (s: {
          id: string
          name: string
          color: string
          pipeline_id: string
          deal_count?: number
        }) => ({
          id: s.id,
          name: s.name,
          color: s.color,
          count: s.deal_count,
          group: selectedPipelineId ? undefined : byPipeline.get(s.pipeline_id),
        }),
      )
  }, [allStages, pipelines, selectedPipelineId])

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  )

  const sendAsMember = teamMembers.find((m) => m.id === sendAsUserId)
  // The list only offers active staff, so a saved campaign can point at
  // someone who has since been deactivated. Rather than silently reassigning
  // it, surface it and make them choose.
  const senderMissing = teamMembers.length > 0 && !!sendAsUserId && !sendAsMember

  const audienceCount = recipientData?.count ?? 0
  const hasAudience =
    selectedLists.length > 0 || selectedTags.length > 0 || selectedStages.length > 0

  // The scheduled instant, resolved so the confirmation can state it plainly.
  const scheduledAtDate = useMemo(() => {
    if (!isScheduled || !scheduledDate) return null
    const [hours, minutes] = scheduledTime.split(':')
    const d = new Date(scheduledDate)
    d.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)
    return d
  }, [isScheduled, scheduledDate, scheduledTime])

  const scheduleInPast =
    !!scheduledAtDate &&
    scheduleCheckedAt > 0 &&
    scheduledAtDate.getTime() <= scheduleCheckedAt

  const canSave = name.trim().length > 0
  const canSend =
    canSave &&
    !senderMissing &&
    hasAudience &&
    !!templateId &&
    audienceCount > 0 &&
    (!isScheduled || (!!scheduledAtDate && !scheduleInPast))

  // A greyed-out button with no explanation is the worst version of
  // validation — the missing field is usually scrolled out of view. Say what
  // is outstanding instead of leaving them to hunt for it.
  const blockers: string[] = []
  if (!name.trim()) blockers.push('a campaign name')
  if (senderMissing) blockers.push('an active person to send as')
  if (!hasAudience) blockers.push('a list, tag or pipeline stage')
  else if (!recipientCountLoading && audienceCount === 0)
    blockers.push('an audience with at least one subscribed contact')
  if (!templateId) blockers.push('a template')
  if (isScheduled && !scheduledAtDate) blockers.push('a send date')
  else if (isScheduled && scheduleInPast) blockers.push('a send time in the future')

  const isPending =
    createCampaign.isPending || updateCampaign.isPending || sendCampaign.isPending

  const handleSubmit = async (saveAsDraft: boolean, sendNow = false) => {
    if (!canSave) return

    if (isScheduled && !saveAsDraft) {
      if (!scheduledAtDate || scheduledAtDate.getTime() <= Date.now()) {
        setScheduleCheckedAt(Date.now())
        toast({
          title: 'Pick a future time',
          description: 'That send time has already passed.',
          variant: 'destructive',
        })
        return
      }
    }

    if (sendNow && !isScheduled && !showSendConfirmation) {
      setShowSendConfirmation(true)
      return
    }

    try {
      const campaignData: CreateCampaignInput = {
        name: name.trim(),
        type: 'email',
        status: saveAsDraft ? 'draft' : isScheduled ? 'scheduled' : 'draft',
        from_user_id: sendAsUserId,
        created_by_id: userId,
        // Stored so the sender uses the recruiter's name in the From line
        // rather than falling back to the generic "IFG Team".
        from_name: sendAsMember?.full_name || undefined,
        email_template_id: templateId || undefined,
        recipient_list_ids: selectedLists,
        recipient_tag_ids: selectedTags,
        recipient_stage_ids: selectedStages,
        scheduled_at:
          !saveAsDraft && isScheduled && scheduledAtDate
            ? scheduledAtDate.toISOString()
            : undefined,
        pipeline_id: selectedPipelineId || null,
      }

      const describe = () =>
        saveAsDraft
          ? `"${name.trim()}" saved as draft.`
          : isScheduled && scheduledAtDate
            ? `"${name.trim()}" will send on ${formatDateLong(scheduledAtDate)} at ${scheduledTime}.`
            : `"${name.trim()}" has been saved.`

      let campaignId = editCampaign?.id

      if (isEditing && editCampaign) {
        await updateCampaign.mutateAsync({ id: editCampaign.id, ...campaignData })
      } else {
        const created = await createCampaign.mutateAsync(campaignData)
        campaignId = created?.id
      }

      if (sendNow && !isScheduled && campaignId) {
        await sendCampaign.mutateAsync(campaignId)
        toast({
          title: 'Campaign sending',
          description: `"${name.trim()}" is going out to ${formatNumber(audienceCount)} contacts.`,
        })
      } else {
        toast({
          title: saveAsDraft
            ? 'Draft saved'
            : isScheduled
              ? 'Campaign scheduled'
              : isEditing
                ? 'Campaign updated'
                : 'Campaign created',
          description: describe(),
        })
      }

      setShowSendConfirmation(false)
      onClose()
    } catch (error) {
      toast({
        title: isEditing ? 'Could not update campaign' : 'Could not create campaign',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const sectionHeading = (step: number, title: string, hint?: string) => (
    <div className="flex items-baseline gap-2 border-b border-slate-200 pb-2 dark:border-slate-700">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
        {step}
      </span>
      <h3 className="text-sm font-semibold uppercase text-blue-700 dark:text-blue-400">
        {title}
      </h3>
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </div>
  )

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
          <SheetHeader className="shrink-0 border-b px-6 pb-4 pt-6">
            <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
              {isEditing ? 'Edit Campaign' : 'Create Campaign'}
            </SheetTitle>
            <SheetDescription>
              Pick who it goes to and which template to send. The template supplies the
              subject, content and branding.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6">
            <div className="space-y-8 py-6">
              {/* ---------------------------------------------- 1. Basics */}
              <div className="space-y-4">
                {sectionHeading(1, 'Campaign')}

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Summer Residency 2027 — first announcement"
                  />
                  <p className="text-xs text-muted-foreground">
                    Internal only. Recipients never see this.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Send as
                  </Label>
                  <Select value={sendAsUserId} onValueChange={setSendAsUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a team member…" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.full_name || member.email}
                          {member.id === userId && ' (You)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {senderMissing ? (
                    <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50">
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <AlertDescription className="text-red-800 dark:text-red-200">
                        The person this campaign was set to send as is no longer active.
                        Pick someone else before sending.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Their name goes in the From line, and their Calendly link fills{' '}
                      {'{{calendly_link}}'}. Replies come back to the CRM either way.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Pipeline{' '}
                    <span className="text-xs font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Select
                    value={selectedPipelineId || 'none'}
                    onValueChange={(value) => {
                      setSelectedPipelineId(value === 'none' ? null : value)
                      setSelectedStages([])
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No pipeline (generic campaign)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No pipeline (generic campaign)</SelectItem>
                      {pipelines.map((pipeline) => (
                        <SelectItem key={pipeline.id} value={pipeline.id}>
                          {pipeline.name}
                          {pipeline.programme && (
                            <span className="ml-1 text-muted-foreground">
                              ({pipeline.programme.name})
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPipelineId && (
                    <Alert className="border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/50">
                      <Info className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <AlertDescription className="text-purple-800 dark:text-purple-200">
                        Replies to this campaign can be turned into deals in this pipeline,
                        assigned round-robin.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>

              {/* -------------------------------------------- 2. Audience */}
              <div className="space-y-4">
                {sectionHeading(2, 'Audience', 'any combination')}

                <AudienceSelect
                  label="Lists"
                  icon={<ListChecks className="h-4 w-4" />}
                  options={listOptions}
                  selectedIds={selectedLists}
                  onToggle={toggle(setSelectedLists)}
                  onClear={() => setSelectedLists([])}
                  placeholder="Select lists…"
                  searchPlaceholder="Search lists…"
                  emptyText="No lists match that search"
                  noOptionsText="No lists yet"
                />

                <AudienceSelect
                  label="Tags"
                  icon={<Tag className="h-4 w-4" />}
                  options={tagOptions}
                  selectedIds={selectedTags}
                  onToggle={toggle(setSelectedTags)}
                  onClear={() => setSelectedTags([])}
                  placeholder="Select tags…"
                  searchPlaceholder="Search tags…"
                  emptyText="No tags match that search"
                  noOptionsText="No tags yet"
                />

                <AudienceSelect
                  label="Pipeline stages"
                  icon={<Layers className="h-4 w-4" />}
                  options={stageOptions}
                  selectedIds={selectedStages}
                  onToggle={toggle(setSelectedStages)}
                  onClear={() => setSelectedStages([])}
                  countNoun="deals"
                  placeholder="Select stages…"
                  searchPlaceholder="Search stages…"
                  emptyText="No stages match that search"
                  noOptionsText="No pipeline stages yet"
                />

                {!hasAudience ? (
                  <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/50">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                      Pick at least one list, tag or pipeline stage. You can mix them —
                      anyone in more than one only gets the email once.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        Will receive this
                      </span>
                      {recipientCountLoading ? (
                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Counting…
                        </span>
                      ) : (
                        <span>
                          <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {formatNumber(audienceCount)}
                          </span>
                          <span className="ml-1 text-sm text-slate-600 dark:text-slate-400">
                            contacts
                          </span>
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      De-duplicated across every source, and unsubscribed or bounced
                      contacts are already excluded.
                    </p>
                    {!recipientCountLoading && audienceCount === 0 && (
                      <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                        Nobody in this selection is still subscribed, so there is nothing to
                        send.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* --------------------------------------------- 3. Content */}
              <div className="space-y-4">
                {sectionHeading(3, 'Email')}

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Template <span className="text-red-500">*</span>
                  </Label>
                  <TemplateSearchSelect
                    templates={templates}
                    value={templateId}
                    onValueChange={setTemplateId}
                    placeholder="Choose a template"
                    groupByCategory
                  />
                </div>

                {selectedTemplate ? (
                  <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                    <div className="flex items-baseline gap-2">
                      <span className="w-16 shrink-0 text-xs uppercase text-muted-foreground">
                        Subject
                      </span>
                      <p className="text-sm font-medium">
                        {selectedTemplate.subject || (
                          <span className="text-red-600 dark:text-red-400">
                            This template has no subject line
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="w-16 shrink-0 text-xs uppercase text-muted-foreground">
                        From
                      </span>
                      <p className="text-sm">
                        {sendAsMember?.full_name || sendAsMember?.email || 'IFG Team'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowPreview(true)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Preview email
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    The template decides the subject line, the content and the global header
                    and footer. Edit those in Templates.
                  </p>
                )}
              </div>

              {/* -------------------------------------------- 4. Schedule */}
              <div className="space-y-4">
                {sectionHeading(4, 'When')}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsScheduled(false)}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-md border p-3 text-sm font-medium transition-colors',
                      !isScheduled
                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
                    )}
                  >
                    <Send className="h-4 w-4" />
                    Send now
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsScheduled(true)
                      setScheduleCheckedAt(Date.now())
                    }}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-md border p-3 text-sm font-medium transition-colors',
                      isScheduled
                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
                    )}
                  >
                    <Clock className="h-4 w-4" />
                    Schedule
                  </button>
                </div>

                {isScheduled && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Date
                        </Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full justify-start text-left font-normal',
                                !scheduledDate && 'text-muted-foreground',
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {scheduledDate ? formatDateLong(scheduledDate) : 'Pick a date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={scheduledDate}
                              onSelect={(date) => {
                                setScheduledDate(date)
                                setScheduleCheckedAt(Date.now())
                              }}
                              // Compare against midnight, not "now" — the old
                              // check disabled today, so you could not schedule
                              // anything for later the same day.
                              disabled={(date) => date < startOfToday()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Time
                        </Label>
                        <Input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => {
                            setScheduledTime(e.target.value)
                            setScheduleCheckedAt(Date.now())
                          }}
                        />
                      </div>
                    </div>

                    {scheduledAtDate && !scheduleInPast && (
                      <p className="text-xs text-muted-foreground">
                        Sends on{' '}
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {formatDateLong(scheduledAtDate)} at {scheduledTime}
                        </span>{' '}
                        — your local time. The scheduler checks every minute, so it may go a
                        minute or so after.
                      </p>
                    )}

                    {scheduleInPast && (
                      <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50">
                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <AlertDescription className="text-red-800 dark:text-red-200">
                          That time has already passed. Pick a time in the future, or switch
                          to Send now.
                        </AlertDescription>
                      </Alert>
                    )}

                    {!scheduledDate && (
                      <p className="text-xs text-muted-foreground">Pick a date to schedule.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <SheetFooter className="shrink-0 flex-col gap-3 border-t bg-slate-50 px-6 py-4 dark:bg-slate-900">
            {blockers.length > 0 && (
              <p className="w-full text-xs text-muted-foreground">
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  Still needed:
                </span>{' '}
                {blockers.length === 1
                  ? blockers[0]
                  : `${blockers.slice(0, -1).join(', ')} and ${blockers[blockers.length - 1]}`}
                .
              </p>
            )}
            <div className="flex w-full gap-3">
              <Button
                variant="outline"
                onClick={() => handleSubmit(true)}
                disabled={!canSave || isPending}
                className="flex-1"
              >
                Save as draft
              </Button>
              <Button
                onClick={() => handleSubmit(false, !isScheduled)}
                disabled={!canSend || isPending}
                className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {sendCampaign.isPending ? 'Sending…' : 'Saving…'}
                  </>
                ) : isScheduled ? (
                  'Schedule'
                ) : recipientCountLoading && hasAudience ? (
                  'Counting…'
                ) : (
                  `Send to ${formatNumber(audienceCount)}`
                )}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Same preview the Templates page uses — a real iframe with the global
          header and footer applied, rather than the old inline-HTML box that
          rendered email tables through Tailwind's prose styles. */}
      <TemplatePreviewModal
        template={(selectedTemplate as Template | null) ?? null}
        open={showPreview}
        onOpenChange={setShowPreview}
      />

      <Dialog open={showSendConfirmation} onOpenChange={setShowSendConfirmation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send this campaign now?</DialogTitle>
            <DialogDescription>
              This goes out immediately and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2 rounded-lg border p-4 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-muted-foreground">Campaign</span>
                <span className="truncate font-medium">{name}</span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-muted-foreground">Subject</span>
                <span className="truncate font-medium">
                  {selectedTemplate?.subject || '(none)'}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-muted-foreground">From</span>
                <span className="truncate font-medium">
                  {sendAsMember?.full_name || sendAsMember?.email || 'IFG Team'}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-muted-foreground">Recipients</span>
                <span className="font-medium">
                  {formatNumber(audienceCount)} contacts
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {selectedLists.length > 0 && (
                <Badge variant="secondary">{selectedLists.length} list(s)</Badge>
              )}
              {selectedTags.length > 0 && (
                <Badge variant="secondary">{selectedTags.length} tag(s)</Badge>
              )}
              {selectedStages.length > 0 && (
                <Badge variant="secondary">{selectedStages.length} stage(s)</Badge>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowSendConfirmation(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => handleSubmit(false, true)}
              disabled={isPending}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                `Yes, send to ${formatNumber(audienceCount)}`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
