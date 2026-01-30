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
} from 'lucide-react'
import { formatDate, formatRelativeTime, formatCurrency } from '@/lib/utils/format'
import { useDealActivities, useAddDealNote } from '@/lib/hooks/useDealActivities'
import { usePipelineStages } from '@/lib/hooks/usePipelineStages'
import { useMoveDeal } from '@/lib/hooks/useDeals'
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

  const { data: activities = [], isLoading: activitiesLoading } = useDealActivities(deal?.id || null)
  const { data: stages = [] } = usePipelineStages(deal?.pipeline_id || null)
  const moveDeal = useMoveDeal()
  const addNote = useAddDealNote()

  // Reset state when deal changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview')
      setNewNote('')
    }
  }, [isOpen, deal?.id])

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
