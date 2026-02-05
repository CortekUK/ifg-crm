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
  Sparkles,
  Loader2,
  Check,
  UserPlus,
  AlertCircle,
  Mail,
  Phone,
  Briefcase,
  Users,
  UserCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/hooks/use-toast'
import {
  analyzeEmailReplies,
  analyzeSMSMessages,
  getConfidenceLevel,
  type MatchSuggestion,
} from '@/lib/utils/smartMatch'
import { usePipelines } from '@/lib/hooks/usePipelines'
import { usePipelineAssignedUsers } from '@/lib/hooks/usePipelineAssignedUsers'
import { useManualRoundRobin } from '@/lib/hooks/useManualRoundRobin'
import { useCreateDeal } from '@/lib/hooks/useCreateDeal'
import type { Contact } from '@/lib/types/contacts'
import type { EmailReply } from '@/lib/types/email'
import type { SMSMessage } from '@/lib/types/sms'

interface SmartMatchModalProps {
  isOpen: boolean
  onClose: () => void
  type: 'email' | 'sms'
  replies?: EmailReply[]
  messages?: SMSMessage[]
  userId: string
}

interface DealSetting {
  createDeal: boolean
  pipelineId: string | null
}

export function SmartMatchModal({
  isOpen,
  onClose,
  type,
  replies = [],
  messages = [],
  userId,
}: SmartMatchModalProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [contacts, setContacts] = useState<Contact[]>([])

  // Deal creation settings
  const [dealSettings, setDealSettings] = useState<Map<string, DealSetting>>(new Map())
  const [assignmentMode, setAssignmentMode] = useState<'round_robin' | 'manual'>('round_robin')
  const [manualAssigneeId, setManualAssigneeId] = useState<string | null>(null)

  const supabase = createClient()
  const queryClient = useQueryClient()
  const { data: pipelines = [] } = usePipelines()
  const roundRobin = useManualRoundRobin()
  const createDeal = useCreateDeal()

  // Get unique pipeline IDs from suggestions that have campaign pipelines
  const activePipelineIds = useMemo(() => {
    const ids = new Set<string>()
    suggestions.forEach((s) => {
      if (s.campaignPipelineId && selectedIds.has(s.replyId)) {
        const setting = dealSettings.get(s.replyId)
        if (setting?.createDeal) {
          ids.add(s.campaignPipelineId)
        }
      }
    })
    return Array.from(ids)
  }, [suggestions, selectedIds, dealSettings])

  // Get assigned users for the first active pipeline (for manual assignment dropdown)
  const firstActivePipelineId = activePipelineIds[0] || null
  const { data: assignedUsers = [] } = usePipelineAssignedUsers(firstActivePipelineId)

  // Check if any selected suggestions have campaign pipelines
  const hasAnyPipelineSuggestions = useMemo(() => {
    return suggestions.some((s) => s.campaignPipelineId && selectedIds.has(s.replyId))
  }, [suggestions, selectedIds])

  // Run analysis when modal opens
  useEffect(() => {
    if (isOpen) {
      runAnalysis()
    } else {
      // Reset state when modal closes
      setSuggestions([])
      setSelectedIds(new Set())
      setDealSettings(new Map())
      setAssignmentMode('round_robin')
      setManualAssigneeId(null)
    }
  }, [isOpen])

  const runAnalysis = async () => {
    setIsAnalyzing(true)

    try {
      // Fetch all contacts for matching
      const { data: contactsData, error } = await supabase
        .from('contacts')
        .select('*')
        .order('first_name')

      if (error) throw error

      setContacts(contactsData || [])

      // Run matching algorithm
      let results: MatchSuggestion[]
      if (type === 'email') {
        results = analyzeEmailReplies(replies, contactsData || [])
      } else {
        results = analyzeSMSMessages(messages, contactsData || [])
      }

      setSuggestions(results)

      // Pre-select high confidence matches (85%+)
      const highConfidenceIds = new Set(
        results
          .filter((s) => s.confidence >= 85 || s.createNew)
          .map((s) => s.replyId)
      )
      setSelectedIds(highConfidenceIds)

      // Initialize deal settings - enable deal creation by default for positive intent with pipeline
      const initialDealSettings = new Map<string, DealSetting>()
      results.forEach((s) => {
        if (s.campaignPipelineId) {
          // Enable deal creation by default for positive intent matches
          const isPositiveIntent = s.aiIntent === 'positive' || s.aiIntent === 'question'
          initialDealSettings.set(s.replyId, {
            createDeal: isPositiveIntent,
            pipelineId: s.campaignPipelineId,
          })
        }
      })
      setDealSettings(initialDealSettings)
    } catch (error) {
      console.error('Analysis error:', error)
      toast({
        title: 'Analysis failed',
        description: 'Could not analyze replies. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const toggleSelection = (replyId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(replyId)) {
        next.delete(replyId)
      } else {
        next.add(replyId)
      }
      return next
    })
  }

  const toggleDealCreation = (replyId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDealSettings((prev) => {
      const next = new Map(prev)
      const current = next.get(replyId)
      if (current) {
        next.set(replyId, { ...current, createDeal: !current.createDeal })
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(suggestions.map((s) => s.replyId)))
  }

  const selectNone = () => {
    setSelectedIds(new Set())
  }

  const selectHighConfidence = () => {
    setSelectedIds(
      new Set(
        suggestions
          .filter((s) => s.confidence >= 85 || s.createNew)
          .map((s) => s.replyId)
      )
    )
  }

  const applyMatches = async () => {
    setIsApplying(true)

    const selectedSuggestions = suggestions.filter((s) =>
      selectedIds.has(s.replyId)
    )

    let matchedCount = 0
    let createdCount = 0
    let dealCount = 0
    let errorCount = 0

    // Track round-robin state per pipeline
    const roundRobinState = new Map<string, string[]>() // pipelineId -> remaining userIds

    try {
      for (const suggestion of selectedSuggestions) {
        try {
          let contactId = suggestion.suggestedContact?.id

          // Check if deal will be created for this suggestion
          const dealSetting = dealSettings.get(suggestion.replyId)
          const willCreateDeal = dealSetting?.createDeal && dealSetting.pipelineId

          // Create new contact if no match
          if (suggestion.createNew || !contactId) {
            if (type === 'email') {
              const nameParts = suggestion.replyName?.split(' ') || []
              const firstName = nameParts[0] || suggestion.replyIdentifier.split('@')[0]
              const lastName = nameParts.slice(1).join(' ') || ''
              const email = suggestion.replyIdentifier.toLowerCase()

              // First check if contact with this email already exists
              const { data: existingContact } = await supabase
                .from('contacts')
                .select('id')
                .eq('email', email)
                .single()

              if (existingContact) {
                contactId = existingContact.id
                // Count as matched since contact already existed
                matchedCount++
              } else {
                // Set graduation_year if deal will be created (so they appear in Players)
                const nextYear = new Date().getFullYear() + 1

                const { data: newContact, error: contactError } = await supabase
                  .from('contacts')
                  .insert({
                    first_name: firstName,
                    last_name: lastName,
                    email: email,
                    source: 'email_reply',
                    sport: 'football',
                    subscription_status: 'subscribed',
                    email_subscribed: true,
                    sms_subscribed: true,
                    graduation_year: willCreateDeal ? nextYear : null,
                  })
                  .select('id')
                  .single()

                if (contactError) {
                  console.error('Contact insert error:', JSON.stringify(contactError))
                  throw contactError
                }
                contactId = newContact.id
                createdCount++
              }
            } else {
              // SMS - create contact with phone
              const phone = suggestion.replyIdentifier

              // First check if contact with this phone already exists
              const { data: existingContact } = await supabase
                .from('contacts')
                .select('id')
                .eq('phone', phone)
                .single()

              if (existingContact) {
                contactId = existingContact.id
                matchedCount++
              } else {
                // Generate placeholder email from phone number
                const cleanPhone = phone.replace(/\D/g, '')
                const placeholderEmail = `sms.${cleanPhone}@placeholder.ifg`

                // Set graduation_year if deal will be created (so they appear in Players)
                const nextYear = new Date().getFullYear() + 1

                const { data: newContact, error: contactError } = await supabase
                  .from('contacts')
                  .insert({
                    first_name: 'Unknown',
                    last_name: phone,
                    email: placeholderEmail,
                    phone: phone,
                    source: 'sms_reply',
                    sport: 'football',
                    subscription_status: 'subscribed',
                    email_subscribed: false,
                    sms_subscribed: true,
                    graduation_year: willCreateDeal ? nextYear : null,
                  })
                  .select('id')
                  .single()

                if (contactError) {
                  console.error('Contact insert error:', JSON.stringify(contactError))
                  throw contactError
                }
                contactId = newContact.id
                createdCount++
              }
            }
          }

          // Update the reply/message with the matched contact
          const pipelineIdToSet = dealSetting?.pipelineId || suggestion.campaignPipelineId

          if (type === 'email') {
            // First update the core fields
            const { error: updateError } = await supabase
              .from('email_replies')
              .update({
                contact_id: contactId,
                match_status: 'manually_matched',
                matched_by_id: userId,
                matched_at: new Date().toISOString(),
              })
              .eq('id', suggestion.replyId)

            if (updateError) {
              console.error('Email reply update error:', JSON.stringify(updateError))
              throw updateError
            }

            // Try to update pipeline_id separately (may fail if column doesn't exist yet)
            if (pipelineIdToSet) {
              try {
                await supabase
                  .from('email_replies')
                  .update({ pipeline_id: pipelineIdToSet } as Record<string, unknown>)
                  .eq('id', suggestion.replyId)
              } catch (pipelineErr) {
                console.warn('Could not set pipeline_id on email reply:', pipelineErr)
              }
            }
          } else {
            const { error: updateError } = await supabase
              .from('sms_messages')
              .update({
                contact_id: contactId,
                match_status: 'manually_matched',
                matched_by_id: userId,
                matched_at: new Date().toISOString(),
              })
              .eq('id', suggestion.replyId)

            if (updateError) {
              console.error('SMS message update error:', JSON.stringify(updateError))
              throw updateError
            }
          }

          // Create deal if enabled and has pipeline
          if (dealSetting?.createDeal && dealSetting.pipelineId && contactId) {
            try {
              // Get first stage for this pipeline
              const { data: firstStage, error: stageError } = await supabase
                .from('pipeline_stages')
                .select('id')
                .eq('pipeline_id', dealSetting.pipelineId)
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
                // Get assigned users for this pipeline
                const { data: pipelineUsers } = await supabase
                  .from('profiles')
                  .select('id')
                  .contains('pipeline_assignments', [dealSetting.pipelineId])
                  .eq('is_active', true)

                const userIds = pipelineUsers?.map((u) => u.id) || []

                if (userIds.length === 0) {
                  // Fallback to current user if no assigned users
                  assigneeId = userId
                } else {
                  // Use the round-robin mutation
                  assigneeId = await roundRobin.mutateAsync({
                    pipelineId: dealSetting.pipelineId,
                    userIds,
                  })
                }
              }

              // Get contact name for deal title
              let contactName = 'Unknown Contact'
              if (suggestion.suggestedContact) {
                contactName = `${suggestion.suggestedContact.first_name} ${suggestion.suggestedContact.last_name}`.trim()
              } else if (suggestion.replyName) {
                contactName = suggestion.replyName
              } else if (type === 'email') {
                contactName = suggestion.replyIdentifier.split('@')[0]
              }

              // Get pipeline name for deal title
              const pipeline = pipelines.find((p) => p.id === dealSetting.pipelineId)
              const pipelineName = pipeline?.name || 'Pipeline'

              // Create the deal with source tracking
              await createDeal.mutateAsync({
                contactId,
                pipelineId: dealSetting.pipelineId,
                stageId: firstStage.id,
                ownerId: assigneeId,
                dealValue: 0,
                title: `${contactName} - ${pipelineName}`,
                notes: `Created from campaign reply via Smart Process`,
                source: 'smart_process',
                campaignId: suggestion.campaignId || undefined,
                campaignName: suggestion.campaignName || undefined,
              })

              dealCount++
            } catch (dealError) {
              console.error('Error creating deal:', dealError)
              // Don't fail the whole match, just log the error
            }
          }

          // Count as matched if we used an existing contact (from algorithm suggestion)
          if (!suggestion.createNew && suggestion.suggestedContact) {
            matchedCount++
          }
        } catch (error) {
          console.error('Error processing suggestion:', JSON.stringify(error, null, 2))
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

      // Build result message
      const parts = []
      if (matchedCount > 0) parts.push(`${matchedCount} matched`)
      if (createdCount > 0) parts.push(`${createdCount} contacts created`)
      if (dealCount > 0) parts.push(`${dealCount} deals created`)
      if (errorCount > 0) parts.push(`${errorCount} errors`)

      toast({
        title: 'Smart Process Complete',
        description: parts.join(', ') + '.',
      })

      onClose()
    } catch (error) {
      toast({
        title: 'Error applying matches',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsApplying(false)
    }
  }

  const getInitials = (contact: Contact) => {
    return `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase() || '??'
  }

  const getNewContactName = (suggestion: MatchSuggestion) => {
    if (type === 'email' && suggestion.replyName) {
      return suggestion.replyName
    }
    if (type === 'email') {
      // Parse name from email address (before @)
      const localPart = suggestion.replyIdentifier.split('@')[0]
      // Convert dots/underscores to spaces and capitalize
      return localPart
        .replace(/[._]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    }
    // For SMS, just show the phone number
    return suggestion.replyIdentifier
  }

  const stats = useMemo(() => {
    const selected = suggestions.filter((s) => selectedIds.has(s.replyId))
    const dealsToCreate = selected.filter((s) => {
      const setting = dealSettings.get(s.replyId)
      return setting?.createDeal && setting.pipelineId
    }).length

    return {
      total: suggestions.length,
      selected: selected.length,
      toMatch: selected.filter((s) => s.suggestedContact && !s.createNew).length,
      toCreate: selected.filter((s) => s.createNew || !s.suggestedContact).length,
      dealsToCreate,
      highConfidence: suggestions.filter((s) => s.confidence >= 90).length,
      mediumConfidence: suggestions.filter((s) => s.confidence >= 70 && s.confidence < 90).length,
      lowConfidence: suggestions.filter((s) => s.confidence > 0 && s.confidence < 70).length,
      noMatch: suggestions.filter((s) => s.confidence === 0).length,
    }
  }, [suggestions, selectedIds, dealSettings])

  // Get pipeline name helper
  const getPipelineName = (pipelineId: string | null) => {
    if (!pipelineId) return null
    const pipeline = pipelines.find((p) => p.id === pipelineId)
    return pipeline?.name || null
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-100 dark:bg-purple-900/50">
              <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <DialogTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
                Smart Process
              </DialogTitle>
              <DialogDescription>
                Match contacts and create deals from {type === 'email' ? 'email replies' : 'SMS messages'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isAnalyzing ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-4">
            <Loader2 className="h-10 w-10 text-purple-500 animate-spin mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              Analysing {type === 'email' ? replies.length : messages.length} {type === 'email' ? 'replies' : 'messages'}...
            </p>
            <p className="text-sm text-muted-foreground">
              Finding the best contact matches
            </p>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-4">
            <AlertCircle className="h-10 w-10 text-slate-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              No unmatched {type === 'email' ? 'replies' : 'messages'} to analyse
            </p>
            <p className="text-sm text-muted-foreground">
              All {type === 'email' ? 'replies' : 'messages'} are already matched
            </p>
          </div>
        ) : (
          <>
            {/* Stats Bar */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-200 dark:bg-slate-700">
                  <span className="font-bold text-foreground">{stats.total}</span>
                  <span className="text-muted-foreground">Analysed</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-100 dark:bg-green-900/30">
                  <span className="font-bold text-green-700 dark:text-green-400">{stats.highConfidence}</span>
                  <span className="text-green-600 dark:text-green-500">High</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/30">
                  <span className="font-bold text-amber-700 dark:text-amber-400">{stats.mediumConfidence}</span>
                  <span className="text-amber-600 dark:text-amber-500">Medium</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700/50">
                  <span className="font-bold text-slate-600 dark:text-slate-400">{stats.noMatch}</span>
                  <span className="text-slate-500 dark:text-slate-500">New</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={selectAll} className="text-xs h-7">
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={selectHighConfidence} className="text-xs h-7">
                  High Confidence
                </Button>
                <Button variant="ghost" size="sm" onClick={selectNone} className="text-xs h-7 text-muted-foreground">
                  Clear
                </Button>
              </div>
            </div>

            {/* Assignment Mode Bar - only shown when deals will be created */}
            {hasAnyPipelineSuggestions && stats.dealsToCreate > 0 && (
              <div className="px-4 py-2 bg-purple-50 dark:bg-purple-950/30 border-b border-purple-200 dark:border-purple-800 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="font-medium text-purple-700 dark:text-purple-300">
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
                      assignmentMode === 'round_robin' && 'bg-purple-600 hover:bg-purple-700'
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
                      assignmentMode === 'manual' && 'bg-purple-600 hover:bg-purple-700'
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
                {suggestions.map((suggestion) => {
                  const isSelected = selectedIds.has(suggestion.replyId)
                  const level = getConfidenceLevel(suggestion.confidence)
                  const dealSetting = dealSettings.get(suggestion.replyId)
                  const hasPipeline = !!suggestion.campaignPipelineId
                  const pipelineName = getPipelineName(suggestion.campaignPipelineId)

                  return (
                    <div
                      key={suggestion.replyId}
                      onClick={() => toggleSelection(suggestion.replyId)}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer',
                        isSelected
                          ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-400 dark:border-purple-600'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelection(suggestion.replyId)}
                        className="shrink-0 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                      />

                      {/* Reply Info */}
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {type === 'email' ? (
                            <Mail className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          ) : (
                            <Phone className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                          )}
                          <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                            {suggestion.replyName || suggestion.replyIdentifier}
                          </span>
                          {suggestion.replyName && (
                            <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                              ({suggestion.replyIdentifier})
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate pl-5">
                          {suggestion.replyPreview}
                        </p>
                      </div>

                      {/* Arrow */}
                      <div className="shrink-0 text-slate-400 dark:text-slate-500 px-1">
                        →
                      </div>

                      {/* Suggested Match */}
                      <div className="w-32 shrink-0 min-w-0">
                        {suggestion.suggestedContact ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8 shrink-0 border-2 border-green-200 dark:border-green-800">
                              <AvatarFallback className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs font-semibold">
                                {getInitials(suggestion.suggestedContact)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 overflow-hidden">
                              <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                                {suggestion.suggestedContact.first_name} {suggestion.suggestedContact.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {suggestion.suggestedContact.email || suggestion.suggestedContact.phone}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 shrink-0 rounded-full bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-800 flex items-center justify-center">
                              <UserPlus className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="min-w-0 overflow-hidden">
                              <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                                {getNewContactName(suggestion)}
                              </p>
                              <p className="text-xs text-blue-600 dark:text-blue-400 truncate">
                                New contact
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Pipeline Badge (only for programme-specific campaigns) */}
                      <div className="w-24 shrink-0">
                        {hasPipeline && pipelineName ? (
                          <Badge
                            variant="outline"
                            className="text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700 truncate max-w-full"
                          >
                            {pipelineName}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>

                      {/* Create Deal Checkbox (only for programme-specific campaigns) */}
                      <div className="w-20 shrink-0 flex items-center justify-center">
                        {hasPipeline ? (
                          <div
                            className="flex items-center gap-1.5"
                            onClick={(e) => toggleDealCreation(suggestion.replyId, e)}
                          >
                            <Checkbox
                              checked={dealSetting?.createDeal || false}
                              className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                            />
                            <span className="text-xs text-muted-foreground">Deal</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>

                      {/* Confidence Badge */}
                      <div className="w-16 shrink-0 text-right">
                        {suggestion.confidence > 0 ? (
                          <Badge
                            className={cn(
                              'font-bold text-xs px-2 py-0.5',
                              level === 'high' && 'bg-green-500 text-white',
                              level === 'medium' && 'bg-amber-500 text-white',
                              level === 'low' && 'bg-red-500 text-white'
                            )}
                          >
                            {suggestion.confidence}%
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-500 text-white font-bold text-xs px-2 py-0.5">
                            New
                          </Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>

            {/* Footer */}
            <DialogFooter className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  <span className="font-semibold text-foreground">{stats.selected} selected</span>
                  {stats.selected > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {stats.toMatch > 0 && (
                        <span className="px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
                          {stats.toMatch} to match
                        </span>
                      )}
                      {stats.toCreate > 0 && (
                        <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium">
                          {stats.toCreate} contacts
                        </span>
                      )}
                      {stats.dealsToCreate > 0 && (
                        <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-medium">
                          {stats.dealsToCreate} deals
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={applyMatches}
                    disabled={stats.selected === 0 || isApplying || (assignmentMode === 'manual' && stats.dealsToCreate > 0 && !manualAssigneeId)}
                    className="bg-purple-600 hover:bg-purple-700 text-white min-w-[160px]"
                  >
                    {isApplying ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        {stats.dealsToCreate > 0
                          ? `Apply & Create ${stats.dealsToCreate} Deals`
                          : `Apply ${stats.selected} Matches`}
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
