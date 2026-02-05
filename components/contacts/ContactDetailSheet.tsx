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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import {
  Mail,
  Phone,
  Pencil,
  Calendar,
  PoundSterling,
  X,
  Plus,
  Zap,
  Search,
  Clock,
  CheckCircle2,
  StopCircle,
  Loader2,
  Video,
  ExternalLink,
  XCircle,
  Activity,
  ArrowRight,
  FileText,
  Trophy,
  Tag,
  MailX,
  MessageSquareOff,
} from 'lucide-react'
import { formatDate, formatRelativeTime, formatTimeAgo } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { useContact, useUpdateContact, useContactDeals, useContactActivities, useContactLists, useContactLastContacted, useContactAutomations, useContactTags, useTags, useAddTagToContact, useRemoveTagFromContact, useContactInvoices, useContactNotes, useAddContactNote, useDeleteContactNote } from '@/lib/hooks/useContacts'
import { useCalendlyEvents, useUpcomingCalendlyEvent } from '@/lib/hooks/useCalendlyEvents'
import { useLists, useAddContactsToList, useRemoveContactFromList } from '@/lib/hooks/useLists'
import { useUnenrollFromAutomation, usePauseEnrollment, useResumeEnrollment } from '@/lib/hooks/useAutomations'
import { toast } from '@/lib/hooks/use-toast'
import type { Contact } from '@/lib/types/contacts'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Pause, Play, MessageCircle } from 'lucide-react'
import { LogReplyModal } from './LogReplyModal'
import { OwnerSelect } from '@/components/ui/owner-select'

interface ContactDetailSheetProps {
  contactId: string | null
  isOpen: boolean
  onClose: () => void
  onEdit?: (contact: Contact) => void
}

function formatSource(source: string | null): string {
  if (!source) return 'Unknown'
  const sourceMap: Record<string, string> = {
    website_form: 'Website Form',
    sms_reply: 'SMS Reply',
    email_reply: 'Email Reply',
    manual: 'Manual Entry',
    csv_import: 'CSV Import',
  }
  return sourceMap[source] || source.replace(/_/g, ' ')
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
  if (type.includes('email')) return 'bg-blue-50 dark:bg-blue-900/20'
  if (type.includes('stage')) return 'bg-purple-50 dark:bg-purple-900/20'
  if (type.includes('deal_won') || type.includes('deal_created')) return 'bg-green-50 dark:bg-green-900/20'
  if (type.includes('deal_lost')) return 'bg-red-50 dark:bg-red-900/20'
  if (type.includes('meeting')) return 'bg-blue-50 dark:bg-blue-900/20'
  return 'bg-slate-50 dark:bg-slate-800/50'
}

export function ContactDetailSheet({
  contactId,
  isOpen,
  onClose,
  onEdit,
}: ContactDetailSheetProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [listSearchQuery, setListSearchQuery] = useState('')
  const [tagSearchQuery, setTagSearchQuery] = useState('')
  const [isAddListOpen, setIsAddListOpen] = useState(false)
  const [isAddTagOpen, setIsAddTagOpen] = useState(false)
  const [isLogReplyOpen, setIsLogReplyOpen] = useState(false)
  const [isEditingOwner, setIsEditingOwner] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState('')

  const { data: contact, isLoading: contactLoading } = useContact(contactId)
  const { data: deals = [], isLoading: dealsLoading } = useContactDeals(contactId)
  const { data: activities = [], isLoading: activitiesLoading } = useContactActivities(contactId)
  const { data: lists = [], isLoading: listsLoading } = useContactLists(contactId)
  const { data: lastContactedAt } = useContactLastContacted(contactId)
  const { data: automations = [], isLoading: automationsLoading } = useContactAutomations(contactId)
  const { data: calendlyEvents = [], isLoading: calendlyEventsLoading } = useCalendlyEvents(contactId)
  const { data: upcomingEvent } = useUpcomingCalendlyEvent(contactId)
  const { data: allLists = [] } = useLists()
  const { data: tags = [], isLoading: tagsLoading } = useContactTags(contactId)
  const { data: allTags = [] } = useTags()
  const { data: invoices = [], isLoading: invoicesLoading } = useContactInvoices(contactId)
  const { data: notes = [], isLoading: notesLoading } = useContactNotes(contactId)

  const addToList = useAddContactsToList()
  const removeFromList = useRemoveContactFromList()
  const addTagToContact = useAddTagToContact()
  const removeTagFromContact = useRemoveTagFromContact()
  const addNote = useAddContactNote()
  const deleteNote = useDeleteContactNote()
  const unenroll = useUnenrollFromAutomation()
  const pauseEnrollment = usePauseEnrollment()
  const resumeEnrollment = useResumeEnrollment()
  const updateContact = useUpdateContact()

  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview')
      setNewNoteContent('')
    }
  }, [isOpen])

  const contactListIds = new Set(lists.map((l) => l.id))
  const availableLists = allLists.filter(
    (list) => !contactListIds.has(list.id) && list.name.toLowerCase().includes(listSearchQuery.toLowerCase())
  )

  const contactTagIds = new Set(tags.map((t) => t.id))
  const availableTags = allTags.filter(
    (tag) => !contactTagIds.has(tag.id) && tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase())
  )

  const totalDealsValue = deals.reduce((sum, deal) => sum + (deal.deal_value || 0), 0)
  const totalInvoicesPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0)
  const totalInvoicesOutstanding = invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((sum, i) => sum + i.amount, 0)

  const handleAddToList = async (listId: string, listName: string) => {
    if (!contactId) return
    try {
      await addToList.mutateAsync({ listId, contactIds: [contactId] })
      toast({ title: 'Added to list', description: `Contact added to "${listName}".` })
      setIsAddListOpen(false)
      setListSearchQuery('')
    } catch {
      toast({ title: 'Error', description: 'Failed to add contact to list.', variant: 'destructive' })
    }
  }

  const handleRemoveFromList = async (listId: string, listName: string) => {
    if (!contactId) return
    try {
      await removeFromList.mutateAsync({ listId, contactId })
      toast({ title: 'Removed from list', description: `Contact removed from "${listName}".` })
    } catch {
      toast({ title: 'Error', description: 'Failed to remove contact from list.', variant: 'destructive' })
    }
  }

  const handleAddTag = async (tagId: string, tagName: string) => {
    if (!contactId) return
    try {
      await addTagToContact.mutateAsync({ contactId, tagId })
      toast({ title: 'Tag added', description: `Added "${tagName}" tag.` })
      setIsAddTagOpen(false)
      setTagSearchQuery('')
    } catch {
      toast({ title: 'Error', description: 'Failed to add tag.', variant: 'destructive' })
    }
  }

  const handleRemoveTag = async (tagId: string, tagName: string) => {
    if (!contactId) return
    try {
      await removeTagFromContact.mutateAsync({ contactId, tagId })
      toast({ title: 'Tag removed', description: `Removed "${tagName}" tag.` })
    } catch {
      toast({ title: 'Error', description: 'Failed to remove tag.', variant: 'destructive' })
    }
  }

  const handleUnenroll = async (enrollmentId: string, name: string) => {
    try {
      await unenroll.mutateAsync({ enrollmentId })
      toast({ title: 'Unenrolled', description: `Removed from "${name}".` })
    } catch {
      toast({ title: 'Error', description: 'Failed to unenroll.', variant: 'destructive' })
    }
  }

  const handlePauseResume = async (enrollmentId: string, status: string) => {
    try {
      if (status === 'active') {
        await pauseEnrollment.mutateAsync({ enrollmentId })
        toast({ title: 'Paused' })
      } else {
        await resumeEnrollment.mutateAsync({ enrollmentId })
        toast({ title: 'Resumed' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update.', variant: 'destructive' })
    }
  }

  const handleAddNote = async () => {
    if (!contactId || !newNoteContent.trim()) return
    try {
      await addNote.mutateAsync({ contactId, content: newNoteContent.trim() })
      setNewNoteContent('')
      toast({ title: 'Note added' })
    } catch {
      toast({ title: 'Error', description: 'Failed to add note.', variant: 'destructive' })
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!contactId) return
    try {
      await deleteNote.mutateAsync({ noteId, contactId })
      toast({ title: 'Note deleted' })
    } catch {
      toast({ title: 'Error', description: 'Failed to delete note.', variant: 'destructive' })
    }
  }

  const handleSaveOwner = async (newOwnerId: string | null) => {
    if (!contactId) return
    try {
      await updateContact.mutateAsync({ contactId, updates: { owner_id: newOwnerId } })
      setIsEditingOwner(false)
      toast({ title: 'Owner updated', description: newOwnerId ? 'Contact owner has been changed.' : 'Contact owner has been removed.' })
    } catch {
      toast({ title: 'Error', description: 'Failed to update owner.', variant: 'destructive' })
    }
  }

  const getInitials = (first?: string, last?: string) => ((first?.[0] || '') + (last?.[0] || '')).toUpperCase() || '??'

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(amount)

  if (contactLoading) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full sm:max-w-xl flex flex-col p-0 gap-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <Skeleton className="h-10 w-full mb-4" />
            <Skeleton className="h-32 w-full" />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  if (!contact) return null

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col p-0 gap-0">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-blue-600 text-white text-lg font-semibold">
                {getInitials(contact.first_name, contact.last_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
                {contact.first_name} {contact.last_name}
              </SheetTitle>
              <SheetDescription className="mt-1 flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <div
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                      contact.email_subscribed !== false
                        ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                        : "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
                    )}
                  >
                    {contact.email_subscribed !== false ? <Mail className="h-3 w-3" /> : <MailX className="h-3 w-3" />}
                    Email
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                      contact.sms_subscribed !== false
                        ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                        : "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
                    )}
                  >
                    {contact.sms_subscribed !== false ? <MessageCircle className="h-3 w-3" /> : <MessageSquareOff className="h-3 w-3" />}
                    SMS
                  </div>
                </div>
                {contact.graduation_year && (
                  <span className="text-muted-foreground">Class of {contact.graduation_year}</span>
                )}
              </SheetDescription>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            <Button variant="outline" size="sm" className="flex-col h-auto py-2 gap-1" asChild>
              <a href={`mailto:${contact.email}`}>
                <Mail className="h-4 w-4" />
                <span className="text-xs">Email</span>
              </a>
            </Button>
            <Button variant="outline" size="sm" className="flex-col h-auto py-2 gap-1" asChild={!!contact.phone} disabled={!contact.phone}>
              {contact.phone ? (
                <a href={`tel:${contact.phone}`}>
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
              <Button variant="outline" size="sm" className="flex-col h-auto py-2 gap-1" onClick={() => onEdit(contact)}>
                <Pencil className="h-4 w-4" />
                <span className="text-xs">Edit</span>
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Upcoming Meeting Banner */}
          {upcomingEvent && (
            <div className="mx-6 mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Video className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-green-900">{upcomingEvent.event_name || 'Meeting scheduled'}</p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {formatDate(upcomingEvent.start_time)} at{' '}
                      {new Date(upcomingEvent.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                {upcomingEvent.join_url && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700" asChild>
                    <a href={upcomingEvent.join_url} target="_blank" rel="noopener noreferrer">
                      Join
                      <ExternalLink className="h-3 w-3 ml-1" />
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
              {/* Contact Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                  Contact Details
                </h3>
                <div className="space-y-3">
                  {contact.email && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Email</span>
                      <a href={`mailto:${contact.email}`} className="text-sm font-medium text-blue-600 hover:underline">
                        {contact.email}
                      </a>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Phone</span>
                      <a href={`tel:${contact.phone}`} className="text-sm font-medium text-blue-600 hover:underline">
                        {contact.phone}
                      </a>
                    </div>
                  )}
                  {(contact.city || contact.country) && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Location</span>
                      <span className="text-sm font-medium">{[contact.city, contact.state, contact.country].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  {contact.graduation_year && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Graduation</span>
                      <span className="text-sm font-medium">Class of {contact.graduation_year}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                  Status
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Last Contacted</span>
                    <span className={cn("text-sm font-medium", lastContactedAt ? 'text-green-600' : 'text-orange-600')}>
                      {lastContactedAt ? formatTimeAgo(lastContactedAt) : 'Never contacted'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Last Activity</span>
                    <span className={cn("text-sm font-medium", contact.last_activity_at ? 'text-green-600' : 'text-orange-600')}>
                      {contact.last_activity_at ? formatTimeAgo(contact.last_activity_at) : 'No activity'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Source</span>
                    <span className="text-sm font-medium">{formatSource(contact.source)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Added</span>
                    <span className="text-sm font-medium">{formatDate(contact.created_at)}</span>
                  </div>
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
                      value={contact.owner_id}
                      onChange={handleSaveOwner}
                      placeholder="Select owner"
                      allowClear
                    />
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setIsEditingOwner(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : contact.owner ? (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-purple-100 dark:bg-purple-900/50 text-purple-600 text-sm">
                        {getInitials(contact.owner.full_name?.split(' ')[0], contact.owner.full_name?.split(' ')[1])}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{contact.owner.full_name || contact.owner.email}</p>
                      <p className="text-xs text-slate-500">{contact.owner.email}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">No owner assigned</p>
                )}
              </div>

              {/* Player Information */}
              {(contact.position || contact.club_name || contact.gpa || contact.sport) && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                    Player Information
                  </h3>
                  <div className="space-y-3">
                    {contact.sport && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Sport</span>
                        <span className="text-sm font-medium">{contact.sport === 'football' ? 'Football' : 'Basketball'}</span>
                      </div>
                    )}
                    {contact.position && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Position</span>
                        <span className="text-sm font-medium">{contact.position}</span>
                      </div>
                    )}
                    {contact.club_name && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Club</span>
                        <span className="text-sm font-medium">{contact.club_name}</span>
                      </div>
                    )}
                    {contact.gpa && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">GPA</span>
                        <span className="text-sm font-medium">{contact.gpa}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Parent/Guardian */}
              {(contact.parent_name || contact.parent_email || contact.parent_phone) && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                    Parent/Guardian
                  </h3>
                  <div className="space-y-3">
                    {contact.parent_name && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Name</span>
                        <span className="text-sm font-medium">{contact.parent_name}</span>
                      </div>
                    )}
                    {contact.parent_email && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Email</span>
                        <a href={`mailto:${contact.parent_email}`} className="text-sm font-medium text-blue-600 hover:underline">
                          {contact.parent_email}
                        </a>
                      </div>
                    )}
                    {contact.parent_phone && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Phone</span>
                        <span className="text-sm font-medium">{contact.parent_phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Lists */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase">
                    Lists
                  </h3>
                  <Popover open={isAddListOpen} onOpenChange={setIsAddListOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-300">
                        <Plus className="h-3 w-3 mr-1" />
                        Add to List
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2" align="end">
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Search lists..."
                            value={listSearchQuery}
                            onChange={(e) => setListSearchQuery(e.target.value)}
                            className="h-8 pl-7 text-sm"
                          />
                        </div>
                        <div className="max-h-40 overflow-y-auto">
                          {availableLists.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-3">
                              {listSearchQuery ? 'No lists found' : 'In all lists'}
                            </p>
                          ) : (
                            availableLists.slice(0, 8).map((list) => (
                              <button
                                key={list.id}
                                onClick={() => handleAddToList(list.id, list.name)}
                                disabled={addToList.isPending}
                                className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                              >
                                {list.name}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                {listsLoading ? (
                  <Skeleton className="h-8 w-full" />
                ) : lists.length === 0 ? (
                  <p className="text-sm text-slate-500">Not in any lists</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {lists.map((list) => (
                      <Badge key={list.id} variant="secondary" className="pr-1">
                        {list.name}
                        <button
                          onClick={() => handleRemoveFromList(list.id, list.name)}
                          className="ml-1 p-0.5 rounded-full hover:bg-slate-300/50"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
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

              {/* Automations */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                  Automations
                </h3>
                {automationsLoading ? (
                  <Skeleton className="h-12 w-full" />
                ) : automations.length === 0 ? (
                  <p className="text-sm text-slate-500">Not enrolled in any automations</p>
                ) : (
                  <div className="space-y-2">
                    {automations.map((enrollment) => {
                      const name = enrollment.automation?.name || 'Unknown'
                      const canManage = enrollment.status === 'active' || enrollment.status === 'paused'
                      return (
                        <div key={enrollment.id} className={cn(
                          'flex items-center justify-between p-3 rounded-lg border',
                          enrollment.status === 'paused' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        )}>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{name}</span>
                              <Badge variant="outline" className={cn(
                                'text-[10px]',
                                enrollment.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' :
                                enrollment.status === 'paused' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-slate-50 dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700'
                              )}>
                                {enrollment.status === 'active' && <Zap className="h-2.5 w-2.5 mr-0.5" />}
                                {enrollment.status === 'paused' && <Pause className="h-2.5 w-2.5 mr-0.5" />}
                                {enrollment.status === 'completed' && <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />}
                                {enrollment.status === 'stopped' && <StopCircle className="h-2.5 w-2.5 mr-0.5" />}
                                {enrollment.status}
                              </Badge>
                            </div>
                            {enrollment.status === 'active' && enrollment.next_step_at && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Next: {formatRelativeTime(enrollment.next_step_at)}
                              </p>
                            )}
                          </div>
                          {canManage && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {enrollment.status === 'active' && (
                                  <DropdownMenuItem onClick={() => handlePauseResume(enrollment.id, 'active')}>
                                    <Pause className="h-4 w-4 mr-2" /> Pause
                                  </DropdownMenuItem>
                                )}
                                {enrollment.status === 'paused' && (
                                  <DropdownMenuItem onClick={() => handlePauseResume(enrollment.id, 'paused')}>
                                    <Play className="h-4 w-4 mr-2" /> Resume
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleUnenroll(enrollment.id, name)} className="text-red-600">
                                  <X className="h-4 w-4 mr-2" /> Unenroll
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Meeting History */}
              {calendlyEvents.length > 0 && !calendlyEventsLoading && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                    Meeting History
                  </h3>
                  <div className="space-y-2">
                    {calendlyEvents
                      .filter((e) => e.status !== 'scheduled' || new Date(e.start_time) <= new Date())
                      .slice(0, 3)
                      .map((event) => (
                        <div key={event.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                          <div>
                            <p className="text-sm font-medium">{event.event_name}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(event.start_time)}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                            Completed
                          </Badge>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Deals Tab */}
            <TabsContent value="deals" className="px-6 py-6 mt-0">
              {dealsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : deals.length === 0 ? (
                <div className="text-center py-12">
                  <PoundSterling className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No deals yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-green-700 dark:text-green-300">Total Pipeline Value</span>
                      <span className="text-xl font-bold text-green-700 dark:text-green-300">{formatCurrency(totalDealsValue)}</span>
                    </div>
                    <p className="text-xs text-green-600 mt-1">{deals.length} deal{deals.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="space-y-2">
                    {deals.map((deal) => (
                      <div
                        key={deal.id}
                        className="p-4 rounded-lg border bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        style={{ borderLeftWidth: 4, borderLeftColor: deal.stage?.color || '#e2e8f0' }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{deal.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs" style={{
                                backgroundColor: deal.stage?.color ? `${deal.stage.color}15` : undefined,
                                color: deal.stage?.color,
                              }}>
                                {deal.stage?.name}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{deal.pipeline?.name}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-600">{formatCurrency(deal.deal_value || 0)}</p>
                            <p className="text-xs text-muted-foreground">{formatTimeAgo(deal.created_at)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="px-6 py-6 mt-0">
              <div className="flex justify-end mb-4">
                <Button variant="outline" size="sm" onClick={() => setIsLogReplyOpen(true)} disabled={!contact.email}>
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

        {contact && (
          <LogReplyModal
            isOpen={isLogReplyOpen}
            onClose={() => setIsLogReplyOpen(false)}
            contactId={contact.id}
            contactName={`${contact.first_name} ${contact.last_name}`}
            contactEmail={contact.email || ''}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
