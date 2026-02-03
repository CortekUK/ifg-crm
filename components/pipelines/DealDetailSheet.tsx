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
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Clock,
  Send,
  CalendarClock,
  Pencil,
  Video,
} from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { useUpdateDeal } from '@/lib/hooks/useDeals'
import { formatDate, formatRelativeTime, formatCurrency, formatTimeAgo } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { useDealActivities, useAddDealNote } from '@/lib/hooks/useDealActivities'
import { usePipelineStages } from '@/lib/hooks/usePipelineStages'
import { useMoveDeal } from '@/lib/hooks/useDeals'
import { useUpcomingCalendlyEvent } from '@/lib/hooks/useCalendlyEvents'
import { toast } from '@/lib/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import { OwnerSelect } from '@/components/ui/owner-select'
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
  const [isEditingProbability, setIsEditingProbability] = useState(false)
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [isEditingOwner, setIsEditingOwner] = useState(false)
  const [editProbability, setEditProbability] = useState<number | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)

  const { data: activities = [], isLoading: activitiesLoading } = useDealActivities(deal?.id || null)
  const { data: stages = [] } = usePipelineStages(deal?.pipeline_id || null)
  const { data: upcomingCalendlyEvent } = useUpcomingCalendlyEvent(deal?.contact_id || null)
  const moveDeal = useMoveDeal()
  const addNote = useAddDealNote()
  const updateDeal = useUpdateDeal()

  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview')
      setNewNote('')
      setIsEditingProbability(false)
      setIsEditingDescription(false)
      setIsEditingOwner(false)
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
      toast({ title: 'Deal moved', description: `Moved to ${newStage?.name || 'new stage'}` })
    } catch (error) {
      toast({ title: 'Failed to move deal', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' })
    }
  }

  const handleMarkWon = async () => {
    if (!deal) return
    const supabase = createClient()
    try {
      await supabase.from('deals').update({ status: 'won', closed_at: new Date().toISOString() }).eq('id', deal.id)
      await supabase.from('deal_activities').insert({ deal_id: deal.id, activity_type: 'deal_won', description: 'Deal marked as won', performed_by_id: userId })
      toast({ title: 'Deal won!', description: 'Congratulations on closing this deal.' })
      onClose()
    } catch (error) {
      toast({ title: 'Failed to update deal', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' })
    }
  }

  const handleMarkLost = async () => {
    if (!deal) return
    const supabase = createClient()
    try {
      await supabase.from('deals').update({ status: 'lost', closed_at: new Date().toISOString() }).eq('id', deal.id)
      await supabase.from('deal_activities').insert({ deal_id: deal.id, activity_type: 'deal_lost', description: 'Deal marked as lost', performed_by_id: userId })
      toast({ title: 'Deal lost', description: 'This deal has been marked as lost.' })
      onClose()
    } catch (error) {
      toast({ title: 'Failed to update deal', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' })
    }
  }

  const handleAddNote = async () => {
    if (!deal || !newNote.trim()) return
    try {
      await addNote.mutateAsync({ dealId: deal.id, note: newNote.trim(), performedById: userId })
      setNewNote('')
      toast({ title: 'Note added', description: 'Your note has been saved.' })
    } catch (error) {
      toast({ title: 'Failed to add note', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' })
    }
  }

  const handleSaveProbability = async () => {
    if (!deal) return
    try {
      await updateDeal.mutateAsync({ dealId: deal.id, updates: { win_probability: editProbability } })
      setIsEditingProbability(false)
      toast({ title: 'Win probability updated', description: editProbability !== null ? `Set to ${editProbability}%` : 'Cleared' })
    } catch (error) {
      toast({ title: 'Failed to update', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' })
    }
  }

  const handleSaveDescription = async () => {
    if (!deal) return
    try {
      await updateDeal.mutateAsync({ dealId: deal.id, updates: { description: editDescription || null } })
      setIsEditingDescription(false)
      toast({ title: 'Description updated', description: 'Deal description has been saved.' })
    } catch (error) {
      toast({ title: 'Failed to update', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' })
    }
  }

  const handleSaveForecastedDate = async (date: Date | undefined) => {
    if (!deal) return
    try {
      await updateDeal.mutateAsync({ dealId: deal.id, updates: { forecasted_close_date: date ? date.toISOString().split('T')[0] : null } })
      setIsDatePickerOpen(false)
      toast({ title: 'Forecasted close date updated', description: date ? `Set to ${formatDate(date.toISOString())}` : 'Cleared' })
    } catch (error) {
      toast({ title: 'Failed to update', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' })
    }
  }

  const handleSaveOwner = async (newOwnerId: string | null) => {
    if (!deal || !newOwnerId) return
    try {
      await updateDeal.mutateAsync({ dealId: deal.id, updates: { deal_owner_id: newOwnerId } })
      setIsEditingOwner(false)
      toast({ title: 'Deal owner updated', description: 'The deal owner has been changed.' })
    } catch (error) {
      toast({ title: 'Failed to update', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' })
    }
  }

  if (!deal) return null

  const notes = activities.filter((a) => a.activity_type === 'note_added')

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col p-0 gap-0">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-blue-600 text-white text-lg font-semibold">
                {getInitials(deal.contact?.first_name, deal.contact?.last_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900">
                {deal.contact ? `${deal.contact.first_name} ${deal.contact.last_name}` : deal.title}
              </SheetTitle>
              <SheetDescription className="mt-1 flex items-center gap-2">
                <span className="text-lg font-semibold text-green-600">{formatCurrency(deal.deal_value || 0)}</span>
              </SheetDescription>
              <div className="flex items-center gap-2 mt-2">
                <Badge style={{ backgroundColor: deal.stage?.color ? `${deal.stage.color}20` : undefined, color: deal.stage?.color || undefined }}>
                  {deal.stage?.name || 'Unknown Stage'}
                </Badge>
                {deal.pipeline && <span className="text-xs text-muted-foreground">{deal.pipeline.name}</span>}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Move to Stage</Label>
              <Select value={deal.current_stage_id} onValueChange={handleStageChange} disabled={moveDeal.isPending}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={handleMarkWon}>
                <Trophy className="h-4 w-4 mr-1" />
                Won
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={handleMarkLost}>
                <XCircle className="h-4 w-4 mr-1" />
                Lost
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Upcoming Meeting Banner */}
          {upcomingCalendlyEvent && (
            <div className="mx-6 mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Video className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-green-900">{upcomingCalendlyEvent.location || 'Meeting'} scheduled</p>
                    <p className="text-sm text-green-700">
                      {formatDate(upcomingCalendlyEvent.start_time)} at{' '}
                      {new Date(upcomingCalendlyEvent.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                {upcomingCalendlyEvent.join_url && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700" asChild>
                    <a href={upcomingCalendlyEvent.join_url} target="_blank" rel="noopener noreferrer">
                      Join <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0 px-6">
              <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm">
                Overview
              </TabsTrigger>
              <TabsTrigger value="activity" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm">
                Activity
              </TabsTrigger>
              <TabsTrigger value="notes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm">
                Notes
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="px-6 py-6 space-y-6 mt-0">
              {/* Deal Owner */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="text-sm font-semibold text-blue-900 uppercase">
                    Deal Owner
                  </h3>
                  {!isEditingOwner && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-700" onClick={() => setIsEditingOwner(true)}>
                      <Pencil className="h-3 w-3 mr-1" /> Change
                    </Button>
                  )}
                </div>
                {isEditingOwner ? (
                  <div className="space-y-3">
                    <OwnerSelect
                      value={deal.deal_owner_id}
                      onChange={handleSaveOwner}
                      placeholder="Select deal owner"
                    />
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setIsEditingOwner(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : deal.owner ? (
                  <>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-purple-100 text-purple-600 text-sm">
                          {getInitials(deal.owner.full_name?.split(' ')[0], deal.owner.full_name?.split(' ')[1])}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{deal.owner.full_name || deal.owner.email}</p>
                        <p className="text-xs text-slate-500">{deal.owner.email}</p>
                      </div>
                    </div>
                    {deal.owner.calendly_url && (
                      <a href={deal.owner.calendly_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <Calendar className="h-3 w-3" /> Book a meeting <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-400 italic">No owner assigned</p>
                )}
              </div>

              {/* Contact Details */}
              {deal.contact && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                    Contact Details
                  </h3>
                  <div className="space-y-3">
                    {deal.contact.email && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Email</span>
                        <a href={`mailto:${deal.contact.email}`} className="text-sm font-medium text-blue-600 hover:underline">
                          {deal.contact.email}
                        </a>
                      </div>
                    )}
                    {deal.contact.phone && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Phone</span>
                        <span className="text-sm font-medium">{deal.contact.phone}</span>
                      </div>
                    )}
                    {deal.contact.graduation_year && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Graduation</span>
                        <span className="text-sm font-medium">Class of {deal.contact.graduation_year}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                  Status
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Time in Stage</span>
                    <span className={cn(
                      'text-sm font-medium px-2 py-0.5 rounded',
                      deal.time_in_stage !== undefined && deal.time_in_stage > 30 ? 'bg-red-100 text-red-700' :
                      deal.time_in_stage !== undefined && deal.time_in_stage > 7 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                    )}>
                      {deal.time_in_stage !== undefined
                        ? deal.time_in_stage < 1 ? 'Less than 1 day'
                        : deal.time_in_stage < 7 ? `${Math.floor(deal.time_in_stage)} day${Math.floor(deal.time_in_stage) === 1 ? '' : 's'}`
                        : deal.time_in_stage < 30 ? `${Math.floor(deal.time_in_stage / 7)} week${Math.floor(deal.time_in_stage / 7) === 1 ? '' : 's'}`
                        : `${Math.floor(deal.time_in_stage / 30)} month${Math.floor(deal.time_in_stage / 30) === 1 ? '' : 's'}`
                        : 'Unknown'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Last Contacted</span>
                    <span className={cn("text-sm font-medium", deal.last_contacted_at ? 'text-green-600' : 'text-orange-600')}>
                      {deal.last_contacted_at ? formatTimeAgo(deal.last_contacted_at) : 'Never contacted'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Deal Forecast */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                  Deal Forecast
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Win Probability</span>
                    {isEditingProbability ? (
                      <div className="flex items-center gap-2">
                        <Input type="number" min={0} max={100} value={editProbability ?? ''} onChange={(e) => setEditProbability(e.target.value ? parseInt(e.target.value) : null)} className="w-16 h-7 text-sm" placeholder="0-100" />
                        <span className="text-sm">%</span>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleSaveProbability}>Save</Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setIsEditingProbability(false)}>Cancel</Button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditProbability(deal.win_probability ?? null); setIsEditingProbability(true) }} className="flex items-center gap-1 text-sm font-medium hover:text-blue-600">
                        {deal.win_probability !== null && deal.win_probability !== undefined ? <span>{deal.win_probability}%</span> : <span className="text-slate-400 italic">Not set</span>}
                        <Pencil className="h-3 w-3 opacity-50" />
                      </button>
                    )}
                  </div>
                  {deal.win_probability !== null && deal.win_probability !== undefined && (
                    <Progress value={deal.win_probability} className="h-2" />
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Forecasted Close</span>
                    <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-1 text-sm font-medium hover:text-blue-600">
                          {deal.forecasted_close_date ? formatDate(deal.forecasted_close_date) : <span className="text-slate-400 italic">Not set</span>}
                          <Pencil className="h-3 w-3 opacity-50" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <CalendarComponent mode="single" selected={deal.forecasted_close_date ? new Date(deal.forecasted_close_date) : undefined} onSelect={handleSaveForecastedDate} initialFocus />
                        {deal.forecasted_close_date && (
                          <div className="p-2 border-t">
                            <Button variant="ghost" size="sm" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleSaveForecastedDate(undefined)}>Clear date</Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="text-sm font-semibold text-blue-900 uppercase">Description</h3>
                  {!isEditingDescription && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-700" onClick={() => { setEditDescription(deal.description || ''); setIsEditingDescription(true) }}>
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                  )}
                </div>
                {isEditingDescription ? (
                  <div className="space-y-2">
                    <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Add a description for this deal..." rows={4} />
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setIsEditingDescription(false)}>Cancel</Button>
                      <Button size="sm" onClick={handleSaveDescription} disabled={updateDeal.isPending}>
                        {updateDeal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                      </Button>
                    </div>
                  </div>
                ) : deal.description ? (
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{deal.description}</p>
                ) : (
                  <p className="text-sm text-slate-400 italic">No description added yet.</p>
                )}
              </div>

              {/* Deal Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                  Deal Information
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Value</span>
                    <span className="text-sm font-medium">{formatCurrency(deal.deal_value || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Source</span>
                    <span className="text-sm font-medium capitalize">{deal.source?.replace(/_/g, ' ') || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Created</span>
                    <span className="text-sm font-medium">{formatDate(deal.created_at)}</span>
                  </div>
                </div>
              </div>

            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="px-6 py-6 mt-0">
              {activitiesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-12 text-slate-500">No activities recorded yet.</div>
              ) : (
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex gap-3 text-sm border-l-2 border-slate-200 pl-3 py-1">
                      <div className="flex-1">
                        <p className="font-medium capitalize">{activity.activity_type.replace(/_/g, ' ')}</p>
                        {activity.description && <p className="text-slate-500">{activity.description}</p>}
                        <p className="text-xs text-slate-400 mt-1">
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
            <TabsContent value="notes" className="px-6 py-6 mt-0 space-y-4">
              <div className="space-y-2">
                <Textarea placeholder="Add a note..." rows={3} value={newNote} onChange={(e) => setNewNote(e.target.value)} />
                <Button onClick={handleAddNote} disabled={!newNote.trim() || addNote.isPending} className="w-full bg-blue-600 hover:bg-blue-700">
                  {addNote.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Note'}
                </Button>
              </div>
              {notes.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-sm">No notes yet. Add your first note above.</div>
              ) : (
                <div className="space-y-3 border-t pt-4">
                  {notes.map((note) => (
                    <div key={note.id} className="bg-slate-50 rounded-lg p-3">
                      <p className="text-sm">{note.description}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        {formatRelativeTime(note.created_at)}
                        {note.performed_by && ` by ${note.performed_by.full_name || note.performed_by.email}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <SheetFooter className="border-t px-6 py-4 bg-slate-50 shrink-0">
          <Button variant="outline" onClick={onClose} className="w-full">
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
