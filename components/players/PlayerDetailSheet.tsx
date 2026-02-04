'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  GraduationCap,
  Building2,
  FileText,
  Upload,
  GitBranch,
  Activity,
  MessageCircle,
  Pencil,
  ArrowRight,
  Trophy,
  XCircle,
  Loader2,
  MailX,
  MessageSquareOff,
  Tag,
  X,
  Plus,
  Search,
  Clock,
  PoundSterling,
  Trash2,
} from 'lucide-react'
import { formatDate, formatCurrency, formatDateLong, formatRelativeTime, formatTimeAgo } from '@/lib/utils/format'
import { usePlayer, usePlayerDeals, usePlayerActivities, useUpdatePlayer } from '@/lib/hooks/usePlayers'
import { useContactTags, useTags, useAddTagToContact, useRemoveTagFromContact, useContactInvoices, useContactNotes, useAddContactNote, useDeleteContactNote } from '@/lib/hooks/useContacts'
import { LogReplyModal } from '@/components/contacts/LogReplyModal'
import { toast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'
import { OwnerSelect } from '@/components/ui/owner-select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import type { Player } from '@/lib/types/players'

interface PlayerDetailSheetProps {
  playerId: string | null
  isOpen: boolean
  onClose: () => void
  onEdit?: (player: Player) => void
}

const getAvatarColour = (name: string) => {
  const colours = ['bg-blue-600', 'bg-green-600', 'bg-purple-600', 'bg-orange-600', 'bg-pink-600', 'bg-teal-600', 'bg-indigo-600', 'bg-red-600']
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colours[hash % colours.length]
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'email_sent':
    case 'email_opened':
      return <Mail className="h-3.5 w-3.5 text-blue-600" />
    case 'stage_changed':
      return <ArrowRight className="h-3.5 w-3.5 text-purple-600" />
    case 'note_added':
      return <FileText className="h-3.5 w-3.5 text-slate-600" />
    case 'deal_created':
    case 'deal_won':
      return <Trophy className="h-3.5 w-3.5 text-green-600" />
    case 'deal_lost':
      return <XCircle className="h-3.5 w-3.5 text-red-600" />
    case 'meeting_scheduled':
    case 'meeting_completed':
      return <Calendar className="h-3.5 w-3.5 text-blue-600" />
    default:
      return <Activity className="h-3.5 w-3.5 text-slate-500" />
  }
}

function getActivityBg(type: string): string {
  if (type.includes('email')) return 'bg-blue-50'
  if (type.includes('stage')) return 'bg-purple-50'
  if (type.includes('deal_won') || type.includes('deal_created')) return 'bg-green-50'
  if (type.includes('deal_lost')) return 'bg-red-50'
  if (type.includes('meeting')) return 'bg-blue-50'
  return 'bg-slate-50'
}

export function PlayerDetailSheet({ playerId, isOpen, onClose, onEdit }: PlayerDetailSheetProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [isLogReplyOpen, setIsLogReplyOpen] = useState(false)
  const [isEditingOwner, setIsEditingOwner] = useState(false)
  const [isAddTagOpen, setIsAddTagOpen] = useState(false)
  const [tagSearchQuery, setTagSearchQuery] = useState('')
  const [newNoteContent, setNewNoteContent] = useState('')

  const { data: player, isLoading } = usePlayer(playerId)
  const { data: deals = [] } = usePlayerDeals(playerId)
  const { data: activities = [], isLoading: activitiesLoading } = usePlayerActivities(playerId)
  const { data: tags = [], isLoading: tagsLoading } = useContactTags(playerId)
  const { data: allTags = [] } = useTags()
  const { data: invoices = [], isLoading: invoicesLoading } = useContactInvoices(playerId)
  const { data: notes = [], isLoading: notesLoading } = useContactNotes(playerId)
  const updatePlayer = useUpdatePlayer()
  const addTagToContact = useAddTagToContact()
  const removeTagFromContact = useRemoveTagFromContact()
  const addNote = useAddContactNote()
  const deleteNote = useDeleteContactNote()

  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview')
      setNewNoteContent('')
    }
  }, [isOpen])

  const contactTagIds = new Set(tags.map((t) => t.id))
  const availableTags = allTags.filter(
    (tag) => !contactTagIds.has(tag.id) && tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase())
  )

  const totalInvoicesPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0)
  const totalInvoicesOutstanding = invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((sum, i) => sum + i.amount, 0)

  const handleAddTag = async (tagId: string, tagName: string) => {
    if (!playerId) return
    try {
      await addTagToContact.mutateAsync({ contactId: playerId, tagId })
      toast({ title: 'Tag added', description: `Added "${tagName}" tag.` })
      setIsAddTagOpen(false)
      setTagSearchQuery('')
    } catch {
      toast({ title: 'Error', description: 'Failed to add tag.', variant: 'destructive' })
    }
  }

  const handleRemoveTag = async (tagId: string, tagName: string) => {
    if (!playerId) return
    try {
      await removeTagFromContact.mutateAsync({ contactId: playerId, tagId })
      toast({ title: 'Tag removed', description: `Removed "${tagName}" tag.` })
    } catch {
      toast({ title: 'Error', description: 'Failed to remove tag.', variant: 'destructive' })
    }
  }

  const handleAddNote = async () => {
    if (!playerId || !newNoteContent.trim()) return
    try {
      await addNote.mutateAsync({ contactId: playerId, content: newNoteContent.trim() })
      setNewNoteContent('')
      toast({ title: 'Note added' })
    } catch {
      toast({ title: 'Error', description: 'Failed to add note.', variant: 'destructive' })
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!playerId) return
    try {
      await deleteNote.mutateAsync({ noteId, contactId: playerId })
      toast({ title: 'Note deleted' })
    } catch {
      toast({ title: 'Error', description: 'Failed to delete note.', variant: 'destructive' })
    }
  }

  const handleSaveOwner = async (newOwnerId: string | null) => {
    if (!playerId) return
    try {
      await updatePlayer.mutateAsync({ playerId, updates: { owner_id: newOwnerId } })
      setIsEditingOwner(false)
      toast({ title: 'Owner updated', description: newOwnerId ? 'Player owner has been changed.' : 'Player owner has been removed.' })
    } catch {
      toast({ title: 'Error', description: 'Failed to update owner.', variant: 'destructive' })
    }
  }

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.[0] || ''
    const last = lastName?.[0] || ''
    return (first + last).toUpperCase() || '??'
  }

  if (!player && !isLoading) return null

  const fullName = player ? `${player.first_name} ${player.last_name}` : ''
  const initials = player ? `${player.first_name?.[0] || ''}${player.last_name?.[0] || ''}`.toUpperCase() : ''
  const avatarColour = getAvatarColour(fullName)

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col p-0 gap-0">
        {isLoading || !player ? (
          <div className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className={`${avatarColour} text-white text-lg font-semibold`}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
                    {fullName}
                  </SheetTitle>
                  <SheetDescription className="mt-1 flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <div
                        className={cn(
                          "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                          player.email_subscribed !== false
                            ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                            : "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
                        )}
                      >
                        {player.email_subscribed !== false ? <Mail className="h-3 w-3" /> : <MailX className="h-3 w-3" />}
                        Email
                      </div>
                      <div
                        className={cn(
                          "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                          player.sms_subscribed !== false
                            ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                            : "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
                        )}
                      >
                        {player.sms_subscribed !== false ? <MessageCircle className="h-3 w-3" /> : <MessageSquareOff className="h-3 w-3" />}
                        SMS
                      </div>
                    </div>
                    {player.position && <span className="text-muted-foreground">{player.position}</span>}
                    {player.graduation_year && <span className="text-muted-foreground">Class of {player.graduation_year}</span>}
                  </SheetDescription>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-4 gap-2 mt-4">
                <Button variant="outline" size="sm" className="flex-col h-auto py-2 gap-1" asChild>
                  <a href={`mailto:${player.email}`}>
                    <Mail className="h-4 w-4" />
                    <span className="text-xs">Email</span>
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="flex-col h-auto py-2 gap-1" asChild={!!player.phone} disabled={!player.phone}>
                  {player.phone ? (
                    <a href={`tel:${player.phone}`}>
                      <Phone className="h-4 w-4" />
                      <span className="text-xs">Call</span>
                    </a>
                  ) : (
                    <>
                      <Phone className="h-4 w-4" />
                      <span className="text-xs">Call</span>
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" className="flex-col h-auto py-2 gap-1" onClick={() => setIsLogReplyOpen(true)}>
                  <MessageCircle className="h-4 w-4" />
                  <span className="text-xs">Log Reply</span>
                </Button>
                {onEdit && (
                  <Button variant="outline" size="sm" className="flex-col h-auto py-2 gap-1" onClick={() => onEdit(player)}>
                    <Pencil className="h-4 w-4" />
                    <span className="text-xs">Edit</span>
                  </Button>
                )}
              </div>
            </SheetHeader>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
                <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0 px-6">
                  <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="deals" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm">
                    Deals
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm">
                    Activity
                  </TabsTrigger>
                  <TabsTrigger value="invoices" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm">
                    Invoices
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm">
                    Notes
                  </TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="px-6 py-6 space-y-6 mt-0">
                  {/* Contact Information */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                      Contact Information
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Email</span>
                        <a href={`mailto:${player.email}`} className="text-sm font-medium text-blue-600 hover:underline">
                          {player.email}
                        </a>
                      </div>
                      {player.phone && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-500">Phone</span>
                          <span className="text-sm font-medium">{player.phone}</span>
                        </div>
                      )}
                      {(player.city || player.state || player.country) && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-500">Location</span>
                          <span className="text-sm font-medium">{[player.city, player.state, player.country].filter(Boolean).join(', ')}</span>
                        </div>
                      )}
                      {player.date_of_birth && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-500">Date of Birth</span>
                          <span className="text-sm font-medium">{formatDateLong(player.date_of_birth)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Parent/Guardian */}
                  {(player.parent_name || player.parent_email || player.parent_phone) && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                        Parent/Guardian
                      </h3>
                      <div className="space-y-3">
                        {player.parent_name && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-500">Name</span>
                            <span className="text-sm font-medium">{player.parent_name}</span>
                          </div>
                        )}
                        {player.parent_email && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-500">Email</span>
                            <a href={`mailto:${player.parent_email}`} className="text-sm font-medium text-blue-600 hover:underline">
                              {player.parent_email}
                            </a>
                          </div>
                        )}
                        {player.parent_phone && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-500">Phone</span>
                            <span className="text-sm font-medium">{player.parent_phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Academic & Club */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                      Academic & Club
                    </h3>
                    <div className="space-y-3">
                      {player.graduation_year && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-500">Graduation</span>
                          <span className="text-sm font-medium">Class of {player.graduation_year}</span>
                        </div>
                      )}
                      {player.gpa && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-500">GPA</span>
                          <span className="text-sm font-medium">{player.gpa.toFixed(2)}</span>
                        </div>
                      )}
                      {player.club_name && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-500">Club</span>
                          <span className="text-sm font-medium">{player.club_name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Assigned To */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase">
                        Assigned To
                      </h3>
                      {!isEditingOwner && (
                        <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-300" onClick={() => setIsEditingOwner(true)}>
                          <Pencil className="h-3 w-3 mr-1" /> Change
                        </Button>
                      )}
                    </div>
                    {isEditingOwner ? (
                      <div className="space-y-3">
                        <OwnerSelect
                          value={player.owner_id}
                          onChange={handleSaveOwner}
                          placeholder="Select owner"
                          allowClear
                        />
                        <Button variant="outline" size="sm" className="w-full" onClick={() => setIsEditingOwner(false)}>
                          Cancel
                        </Button>
                      </div>
                    ) : player.owner ? (
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-purple-100 dark:bg-purple-900/50 text-purple-600 text-sm">
                            {getInitials(player.owner.full_name?.split(' ')[0], player.owner.full_name?.split(' ')[1])}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{player.owner.full_name || player.owner.email}</p>
                          <p className="text-xs text-slate-500">{player.owner.email}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic">No owner assigned</p>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase">
                        Tags
                      </h3>
                      <Popover open={isAddTagOpen} onOpenChange={setIsAddTagOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-300">
                            <Plus className="h-3 w-3 mr-1" />
                            Add Tag
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2" align="end">
                          <div className="space-y-2">
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                              <Input
                                placeholder="Search tags..."
                                value={tagSearchQuery}
                                onChange={(e) => setTagSearchQuery(e.target.value)}
                                className="h-8 pl-7 text-sm"
                              />
                            </div>
                            <div className="max-h-40 overflow-y-auto">
                              {availableTags.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-3">
                                  {tagSearchQuery ? 'No tags found' : 'All tags applied'}
                                </p>
                              ) : (
                                availableTags.slice(0, 8).map((tag) => (
                                  <button
                                    key={tag.id}
                                    onClick={() => handleAddTag(tag.id, tag.name)}
                                    disabled={addTagToContact.isPending}
                                    className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
                                  >
                                    <div
                                      className="w-2.5 h-2.5 rounded-full"
                                      style={{ backgroundColor: tag.color }}
                                    />
                                    {tag.name}
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    {tagsLoading ? (
                      <Skeleton className="h-8 w-full" />
                    ) : tags.length === 0 ? (
                      <p className="text-sm text-slate-500">No tags applied</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="secondary"
                            className="pr-1"
                            style={{
                              backgroundColor: `${tag.color}20`,
                              color: tag.color,
                              borderColor: tag.color,
                            }}
                          >
                            <Tag className="h-3 w-3 mr-1" />
                            {tag.name}
                            <button
                              onClick={() => handleRemoveTag(tag.id, tag.name)}
                              className="ml-1 p-0.5 rounded-full hover:bg-slate-300/50"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Deals Tab */}
                <TabsContent value="deals" className="px-6 py-6 mt-0">
                  {deals.length === 0 ? (
                    <div className="text-center py-12">
                      <GitBranch className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                      <p className="text-slate-500">No deals for this player yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {deals.map((deal) => (
                        <div key={deal.id} className="p-4 rounded-lg border bg-white dark:bg-slate-900 dark:bg-slate-900" style={{ borderLeftWidth: 4, borderLeftColor: deal.stage?.color || '#e2e8f0' }}>
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">{deal.pipeline?.name || 'Unknown Pipeline'}</p>
                              <Badge style={{ backgroundColor: `${deal.stage?.color}20`, color: deal.stage?.color }} className="mt-1">
                                {deal.stage?.name || 'Unknown Stage'}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-green-600">{formatCurrency(deal.deal_value)}</p>
                              <p className="text-xs text-slate-500 mt-1">{deal.owner?.full_name || 'Unassigned'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Activity Tab */}
                <TabsContent value="activity" className="px-6 py-6 mt-0">
                  <div className="flex justify-end mb-4">
                    <Button variant="outline" size="sm" onClick={() => setIsLogReplyOpen(true)} disabled={!player.email}>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Log Reply
                    </Button>
                  </div>
                  {activitiesLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="text-center py-12">
                      <Activity className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-muted-foreground">No activities yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activities.map((activity) => (
                        <div key={activity.id} className="flex gap-3">
                          <div className={cn('flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center', getActivityBg(activity.activity_type))}>
                            {getActivityIcon(activity.activity_type)}
                          </div>
                          <div className="flex-1 pb-3 border-b last:border-0">
                            <p className="text-sm font-medium capitalize">{activity.activity_type.replace(/_/g, ' ')}</p>
                            {activity.description && <p className="text-sm text-muted-foreground">{activity.description}</p>}
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

                {/* Invoices Tab */}
                <TabsContent value="invoices" className="px-6 py-6 mt-0">
                  {invoicesLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : invoices.length === 0 ? (
                    <div className="text-center py-12">
                      <PoundSterling className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-muted-foreground">No invoices yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Invoice Summary */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                          <p className="text-xs text-green-600 dark:text-green-400 font-medium">Paid</p>
                          <p className="text-lg font-bold text-green-700 dark:text-green-300">{formatCurrency(totalInvoicesPaid)}</p>
                        </div>
                        <div className={cn(
                          "border rounded-lg p-3",
                          totalInvoicesOutstanding > 0
                            ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        )}>
                          <p className={cn(
                            "text-xs font-medium",
                            totalInvoicesOutstanding > 0 ? "text-orange-600 dark:text-orange-400" : "text-slate-600 dark:text-slate-400"
                          )}>Outstanding</p>
                          <p className={cn(
                            "text-lg font-bold",
                            totalInvoicesOutstanding > 0 ? "text-orange-700 dark:text-orange-300" : "text-slate-700 dark:text-slate-300"
                          )}>{formatCurrency(totalInvoicesOutstanding)}</p>
                        </div>
                      </div>

                      {/* Invoice List */}
                      <div className="space-y-2">
                        {invoices.map((invoice) => {
                          const statusConfig = {
                            draft: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300' },
                            sent: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
                            paid: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
                            overdue: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' },
                            cancelled: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-500' },
                          }[invoice.status] || { bg: 'bg-slate-100', text: 'text-slate-600' }

                          return (
                            <div
                              key={invoice.id}
                              className="p-4 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm">{invoice.invoice_number}</p>
                                    <Badge className={cn("text-[10px]", statusConfig.bg, statusConfig.text)}>
                                      {invoice.status}
                                    </Badge>
                                  </div>
                                  {invoice.description && (
                                    <p className="text-sm text-muted-foreground mt-1">{invoice.description}</p>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {invoice.type.replace(/_/g, ' ')}
                                    {invoice.due_date && ` • Due ${formatDate(invoice.due_date)}`}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className={cn(
                                    "font-semibold",
                                    invoice.status === 'paid' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'
                                  )}>
                                    {formatCurrency(invoice.amount)}
                                  </p>
                                  {invoice.paid_at && (
                                    <p className="text-xs text-green-600 dark:text-green-400">
                                      Paid {formatDate(invoice.paid_at)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Notes Tab */}
                <TabsContent value="notes" className="px-6 py-6 mt-0 space-y-4">
                  {/* Add Note Input */}
                  <div className="space-y-3">
                    <Textarea
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      placeholder="Add a note..."
                      rows={3}
                      className="resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault()
                          handleAddNote()
                        }
                      }}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Press Cmd+Enter to save</p>
                      <Button
                        onClick={handleAddNote}
                        disabled={!newNoteContent.trim() || addNote.isPending}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {addNote.isPending ? (
                          <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Adding...</>
                        ) : (
                          <><Plus className="mr-1 h-3 w-3" /> Add Note</>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Notes List */}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    {notesLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    ) : notes.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                        <p className="text-muted-foreground">No notes yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Add a note above to get started</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {notes.map((note) => (
                          <div
                            key={note.id}
                            className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap flex-1">
                                {note.content}
                              </p>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-600"
                                onClick={() => handleDeleteNote(note.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>
                                {formatDate(note.created_at)} at {new Date(note.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {note.created_by && (
                                <>
                                  <span>•</span>
                                  <span>{note.created_by.full_name || note.created_by.email}</span>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Footer */}
            <SheetFooter className="border-t px-6 py-4 bg-slate-50 dark:bg-slate-800 shrink-0">
              <Button variant="outline" onClick={onClose} className="w-full">
                Close
              </Button>
            </SheetFooter>

            {player && (
              <LogReplyModal
                isOpen={isLogReplyOpen}
                onClose={() => setIsLogReplyOpen(false)}
                contactId={player.id}
                contactName={`${player.first_name} ${player.last_name}`}
                contactEmail={player.email || ''}
              />
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
