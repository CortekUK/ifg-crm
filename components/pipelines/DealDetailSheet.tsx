'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Mail,
  Phone,
  Calendar,
  ExternalLink,
  Loader2,
  Trophy,
  XCircle,
  PoundSterling,
  Clock,
  Send,
  TrendingUp,
  CalendarClock,
  FileText,
  ChevronDown,
  ChevronUp,
  Pencil,
  Video,
} from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { useUpdateDeal } from '@/lib/hooks/useDeals'
import { formatDate, formatRelativeTime, formatCurrency, formatTimeAgo, formatDuration } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { useDealActivities, useAddDealNote } from '@/lib/hooks/useDealActivities'
import { usePipelineStages } from '@/lib/hooks/usePipelineStages'
import { useMoveDeal } from '@/lib/hooks/useDeals'
import { useUpcomingCalendlyEvent } from '@/lib/hooks/useCalendlyEvents'
import { toast } from '@/lib/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import type { Deal } from '@/lib/types/pipelines'

interface DealDetailSheetProps {
  deal: Deal | null
  isOpen: boolean
  onClose: () => void
  userId: string
}

export function DealDetailSheet({
  deal,
  isOpen,
  onClose,
  userId,
}: DealDetailSheetProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [newNote, setNewNote] = useState('')
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [isEditingProbability, setIsEditingProbability] = useState(false)
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editProbability, setEditProbability] = useState<number | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)

  const { data: activities = [], isLoading: activitiesLoading } = useDealActivities(deal?.id || null)
  const { data: stages = [] } = usePipelineStages(deal?.pipeline_id || null)
  const { data: upcomingCalendlyEvent } = useUpcomingCalendlyEvent(deal?.contact_id || null)
  const moveDeal = useMoveDeal()
  const addNote = useAddDealNote()
  const updateDeal = useUpdateDeal()

  // Reset state when deal changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview')
      setNewNote('')
      setIsDescriptionExpanded(false)
      setIsEditingProbability(false)
      setIsEditingDescription(false)
      setEditProbability(deal?.win_probability ?? null)
      setEditDescription(deal?.description || '')
    }
  }, [isOpen, deal?.id, deal?.win_probability, deal?.description])

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.[0] || ''
    const last = lastName?.[0] || ''
    return (first + last).toUpperCase() || '??'
  }

  const handleStageChange = async (newStageId: string) => {
    if (!deal) return

    const oldStage = stages.find((s) => s.id === deal.current_stage_id)
    const newStage = stages.find((s) => s.id === newStageId)

    try {
      await moveDeal.mutateAsync({
        dealId: deal.id,
        newStageId,
        pipelineId: deal.pipeline_id,
        oldStageName: oldStage?.name,
        newStageName: newStage?.name,
        performedById: userId,
      })

      toast({
        title: 'Deal moved',
        description: `Moved to ${newStage?.name || 'new stage'}`,
      })
    } catch (error) {
      toast({
        title: 'Failed to move deal',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleMarkWon = async () => {
    if (!deal) return

    const supabase = createClient()

    try {
      await supabase
        .from('deals')
        .update({ status: 'won', closed_at: new Date().toISOString() })
        .eq('id', deal.id)

      await supabase.from('deal_activities').insert({
        deal_id: deal.id,
        activity_type: 'deal_won',
        description: 'Deal marked as won',
        performed_by_id: userId,
      })

      toast({
        title: 'Deal won!',
        description: 'Congratulations on closing this deal.',
      })

      onClose()
    } catch (error) {
      toast({
        title: 'Failed to update deal',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleMarkLost = async () => {
    if (!deal) return

    const supabase = createClient()

    try {
      await supabase
        .from('deals')
        .update({ status: 'lost', closed_at: new Date().toISOString() })
        .eq('id', deal.id)

      await supabase.from('deal_activities').insert({
        deal_id: deal.id,
        activity_type: 'deal_lost',
        description: 'Deal marked as lost',
        performed_by_id: userId,
      })

      toast({
        title: 'Deal lost',
        description: 'This deal has been marked as lost.',
      })

      onClose()
    } catch (error) {
      toast({
        title: 'Failed to update deal',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleAddNote = async () => {
    if (!deal || !newNote.trim()) return

    try {
      await addNote.mutateAsync({
        dealId: deal.id,
        note: newNote.trim(),
        performedById: userId,
      })

      setNewNote('')

      toast({
        title: 'Note added',
        description: 'Your note has been saved.',
      })
    } catch (error) {
      toast({
        title: 'Failed to add note',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleSaveProbability = async () => {
    if (!deal) return

    try {
      await updateDeal.mutateAsync({
        dealId: deal.id,
        updates: { win_probability: editProbability },
      })
      setIsEditingProbability(false)
      toast({
        title: 'Win probability updated',
        description: editProbability !== null ? `Set to ${editProbability}%` : 'Cleared',
      })
    } catch (error) {
      toast({
        title: 'Failed to update',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleSaveDescription = async () => {
    if (!deal) return

    try {
      await updateDeal.mutateAsync({
        dealId: deal.id,
        updates: { description: editDescription || null },
      })
      setIsEditingDescription(false)
      toast({
        title: 'Description updated',
        description: 'Deal description has been saved.',
      })
    } catch (error) {
      toast({
        title: 'Failed to update',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleSaveForecastedDate = async (date: Date | undefined) => {
    if (!deal) return

    try {
      await updateDeal.mutateAsync({
        dealId: deal.id,
        updates: { forecasted_close_date: date ? date.toISOString().split('T')[0] : null },
      })
      setIsDatePickerOpen(false)
      toast({
        title: 'Forecasted close date updated',
        description: date ? `Set to ${formatDate(date.toISOString())}` : 'Cleared',
      })
    } catch (error) {
      toast({
        title: 'Failed to update',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const getProbabilityColor = (probability: number | null | undefined) => {
    if (probability === null || probability === undefined) return 'bg-gray-200'
    if (probability >= 75) return 'bg-green-500'
    if (probability >= 50) return 'bg-blue-500'
    if (probability >= 25) return 'bg-amber-500'
    return 'bg-red-500'
  }

  if (!deal) return null

  const notes = activities.filter((a) => a.activity_type === 'note_added')

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
                {getInitials(deal.contact?.first_name, deal.contact?.last_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <SheetTitle className="text-lg">
                {deal.contact
                  ? `${deal.contact.first_name} ${deal.contact.last_name}`
                  : deal.title}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-semibold text-green-600">
                  {formatCurrency(deal.deal_value || 0)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge
                  style={{
                    backgroundColor: deal.stage?.color ? `${deal.stage.color}20` : undefined,
                    color: deal.stage?.color || undefined,
                  }}
                >
                  {deal.stage?.name || 'Unknown Stage'}
                </Badge>
                {deal.pipeline && (
                  <span className="text-xs text-muted-foreground">{deal.pipeline.name}</span>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Upcoming Meeting Indicator */}
        {upcomingCalendlyEvent && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-green-100 rounded">
                  <Video className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-900">
                    {upcomingCalendlyEvent.location || 'Meeting'} scheduled
                  </p>
                  <p className="text-xs text-green-700">
                    {formatDate(upcomingCalendlyEvent.start_time)} at{' '}
                    {new Date(upcomingCalendlyEvent.start_time).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
              {upcomingCalendlyEvent.join_url && (
                <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                  <a href={upcomingCalendlyEvent.join_url} target="_blank" rel="noopener noreferrer">
                    Join
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2 pb-4 border-b">
          <div className="space-y-1">
            <Label className="text-xs">Move to Stage</Label>
            <Select
              value={deal.current_stage_id}
              onValueChange={handleStageChange}
              disabled={moveDeal.isPending}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-1">
            <Button size="sm" variant="outline" className="flex-1" onClick={handleMarkWon}>
              <Trophy className="h-3 w-3 mr-1" />
              Won
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={handleMarkLost}>
              <XCircle className="h-3 w-3 mr-1" />
              Lost
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Contact Details */}
            {deal.contact && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Contact Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {deal.contact.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${deal.contact.email}`} className="text-blue-600 hover:underline">
                        {deal.contact.email}
                      </a>
                    </div>
                  )}
                  {deal.contact.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{deal.contact.phone}</span>
                    </div>
                  )}
                  {deal.contact.graduation_year && (
                    <div className="text-muted-foreground">
                      Class of {deal.contact.graduation_year}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Time in Stage & Last Contacted */}
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-4 space-y-3">
                {/* Time in Stage */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Time in Stage</span>
                  </div>
                  <span
                    className={cn(
                      'font-semibold text-sm px-2 py-1 rounded',
                      deal.time_in_stage !== undefined && deal.time_in_stage > 30
                        ? 'bg-red-100 text-red-700'
                        : deal.time_in_stage !== undefined && deal.time_in_stage > 7
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-700'
                    )}
                  >
                    {deal.time_in_stage !== undefined
                      ? deal.time_in_stage < 1
                        ? 'Less than 1 day'
                        : deal.time_in_stage < 7
                        ? `${Math.floor(deal.time_in_stage)} day${Math.floor(deal.time_in_stage) === 1 ? '' : 's'}`
                        : deal.time_in_stage < 30
                        ? `${Math.floor(deal.time_in_stage / 7)} week${Math.floor(deal.time_in_stage / 7) === 1 ? '' : 's'}`
                        : `${Math.floor(deal.time_in_stage / 30)} month${Math.floor(deal.time_in_stage / 30) === 1 ? '' : 's'}`
                      : 'Unknown'}
                  </span>
                </div>

                {/* Last Contacted */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Send className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Last Contacted</span>
                  </div>
                  <span
                    className={cn(
                      'font-medium text-sm',
                      deal.last_contacted_at ? 'text-green-700' : 'text-orange-600'
                    )}
                  >
                    {deal.last_contacted_at
                      ? formatTimeAgo(deal.last_contacted_at)
                      : 'Never contacted'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Win Probability & Forecasted Close */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Deal Forecast
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Win Probability */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Win Probability</span>
                    {isEditingProbability ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={editProbability ?? ''}
                          onChange={(e) => setEditProbability(e.target.value ? parseInt(e.target.value) : null)}
                          className="w-20 h-7 text-sm"
                          placeholder="0-100"
                        />
                        <span className="text-sm">%</span>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleSaveProbability}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setIsEditingProbability(false)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditProbability(deal.win_probability ?? null)
                          setIsEditingProbability(true)
                        }}
                        className="flex items-center gap-2 text-sm font-medium hover:text-blue-600 transition-colors"
                      >
                        {deal.win_probability !== null && deal.win_probability !== undefined ? (
                          <span>{deal.win_probability}%</span>
                        ) : (
                          <span className="text-muted-foreground italic">Not set</span>
                        )}
                        <Pencil className="h-3 w-3 opacity-50" />
                      </button>
                    )}
                  </div>
                  {deal.win_probability !== null && deal.win_probability !== undefined && (
                    <Progress 
                      value={deal.win_probability} 
                      className="h-2"
                    />
                  )}
                </div>

                {/* Forecasted Close Date */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <CalendarClock className="h-4 w-4" />
                    Forecasted Close
                  </span>
                  <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-2 text-sm font-medium hover:text-blue-600 transition-colors">
                        {deal.forecasted_close_date ? (
                          <span>{formatDate(deal.forecasted_close_date)}</span>
                        ) : (
                          <span className="text-muted-foreground italic">Not set</span>
                        )}
                        <Pencil className="h-3 w-3 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <CalendarComponent
                        mode="single"
                        selected={deal.forecasted_close_date ? new Date(deal.forecasted_close_date) : undefined}
                        onSelect={handleSaveForecastedDate}
                        initialFocus
                      />
                      {deal.forecasted_close_date && (
                        <div className="p-2 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleSaveForecastedDate(undefined)}
                          >
                            Clear date
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </CardContent>
            </Card>

            {/* Deal Description */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Description
                  </CardTitle>
                  {!isEditingDescription && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => {
                        setEditDescription(deal.description || '')
                        setIsEditingDescription(true)
                      }}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isEditingDescription ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Add a description for this deal..."
                      rows={4}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingDescription(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveDescription}
                        disabled={updateDeal.isPending}
                      >
                        {updateDeal.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Save'
                        )}
                      </Button>
                    </div>
                  </div>
                ) : deal.description ? (
                  <div className="text-sm">
                    <p className={cn(
                      'text-gray-700 whitespace-pre-wrap',
                      !isDescriptionExpanded && deal.description.length > 150 && 'line-clamp-3'
                    )}>
                      {deal.description}
                    </p>
                    {deal.description.length > 150 && (
                      <button
                        onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                        className="text-blue-600 hover:text-blue-700 text-xs mt-1 flex items-center gap-1"
                      >
                        {isDescriptionExpanded ? (
                          <>Show less <ChevronUp className="h-3 w-3" /></>
                        ) : (
                          <>Show more <ChevronDown className="h-3 w-3" /></>
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No description added yet.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Deal Information */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Deal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Value</span>
                  <span className="font-medium">{formatCurrency(deal.deal_value || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Source</span>
                  <span className="capitalize">{deal.source?.replace(/_/g, ' ') || 'Unknown'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatDate(deal.created_at)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Owner Information */}
            {deal.owner && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Deal Owner</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-purple-100 text-purple-600">
                        {getInitials(deal.owner.full_name?.split(' ')[0], deal.owner.full_name?.split(' ')[1])}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{deal.owner.full_name || deal.owner.email}</p>
                      <p className="text-xs text-muted-foreground">{deal.owner.email}</p>
                    </div>
                  </div>
                  {deal.owner.calendly_url && (
                    <a
                      href={deal.owner.calendly_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <Calendar className="h-3 w-3" />
                      Book a meeting
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="mt-4">
            {activitiesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No activities recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex gap-3 text-sm border-l-2 border-gray-200 pl-3 py-1">
                    <div className="flex-1">
                      <p className="font-medium capitalize">
                        {activity.activity_type.replace(/_/g, ' ')}
                      </p>
                      {activity.description && (
                        <p className="text-muted-foreground">{activity.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatRelativeTime(activity.created_at)}
                        {activity.performed_by && ` by ${activity.performed_by.full_name || activity.performed_by.email}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Textarea
                placeholder="Add a note..."
                rows={3}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
              <Button
                onClick={handleAddNote}
                disabled={!newNote.trim() || addNote.isPending}
                className="w-full"
              >
                {addNote.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Note'
                )}
              </Button>
            </div>

            {notes.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No notes yet. Add your first note above.
              </div>
            ) : (
              <div className="space-y-3 border-t pt-4">
                {notes.map((note) => (
                  <div key={note.id} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm">{note.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatRelativeTime(note.created_at)}
                      {note.performed_by && ` by ${note.performed_by.full_name || note.performed_by.email}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
