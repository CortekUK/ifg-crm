'use client'

import { useState } from 'react'
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
  MapPin,
  GraduationCap,
  Trophy,
  Users,
  Pencil,
  Calendar,
  PoundSterling,
  Send,
  X,
  Plus,
  Zap,
  ListIcon,
  Search,
  Clock,
  CheckCircle2,
  StopCircle,
  Loader2,
  Video,
  ExternalLink,
  CalendarCheck,
  XCircle,
} from 'lucide-react'
import { formatDate, formatRelativeTime, formatTimeAgo } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { useContact, useContactDeals, useContactActivities, useContactLists, useContactLastContacted, useContactAutomations } from '@/lib/hooks/useContacts'
import { useCalendlyEvents } from '@/lib/hooks/useCalendlyEvents'
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

interface ContactDetailSheetProps {
  contactId: string | null
  isOpen: boolean
  onClose: () => void
  onEdit?: (contact: Contact) => void
}

export function ContactDetailSheet({
  contactId,
  isOpen,
  onClose,
  onEdit,
}: ContactDetailSheetProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [listSearchQuery, setListSearchQuery] = useState('')
  const [isAddListOpen, setIsAddListOpen] = useState(false)
  const [isLogReplyOpen, setIsLogReplyOpen] = useState(false)

  const { data: contact, isLoading: contactLoading } = useContact(contactId)
  const { data: deals = [], isLoading: dealsLoading } = useContactDeals(contactId)
  const { data: activities = [], isLoading: activitiesLoading } = useContactActivities(contactId)
  const { data: lists = [], isLoading: listsLoading } = useContactLists(contactId)
  const { data: lastContactedAt } = useContactLastContacted(contactId)
  const { data: automations = [], isLoading: automationsLoading } = useContactAutomations(contactId)
  const { data: calendlyEvents = [], isLoading: calendlyEventsLoading } = useCalendlyEvents(contactId)
  const { data: allLists = [] } = useLists()

  const addToList = useAddContactsToList()
  const removeFromList = useRemoveContactFromList()
  const unenroll = useUnenrollFromAutomation()
  const pauseEnrollment = usePauseEnrollment()
  const resumeEnrollment = useResumeEnrollment()

  // Filter out lists the contact is already in
  const contactListIds = new Set(lists.map((l) => l.id))
  const availableLists = allLists.filter(
    (list) =>
      !contactListIds.has(list.id) &&
      list.name.toLowerCase().includes(listSearchQuery.toLowerCase())
  )

  const handleAddToList = async (listId: string, listName: string) => {
    if (!contactId) return

    try {
      await addToList.mutateAsync({ listId, contactIds: [contactId] })
      toast({
        title: 'Added to list',
        description: `Contact added to "${listName}".`,
      })
      setIsAddListOpen(false)
      setListSearchQuery('')
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add contact to list.',
        variant: 'destructive',
      })
    }
  }

  const handleRemoveFromList = async (listId: string, listName: string) => {
    if (!contactId) return

    try {
      await removeFromList.mutateAsync({ listId, contactId })
      toast({
        title: 'Removed from list',
        description: `Contact removed from "${listName}".`,
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove contact from list.',
        variant: 'destructive',
      })
    }
  }

  const handleUnenrollFromAutomation = async (enrollmentId: string, automationName: string) => {
    try {
      await unenroll.mutateAsync({ enrollmentId })
      toast({
        title: 'Unenrolled',
        description: `Contact removed from "${automationName}".`,
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to unenroll contact.',
        variant: 'destructive',
      })
    }
  }

  const handlePauseResumeAutomation = async (enrollmentId: string, currentStatus: string) => {
    try {
      if (currentStatus === 'active') {
        await pauseEnrollment.mutateAsync({ enrollmentId })
        toast({ title: 'Enrollment paused' })
      } else if (currentStatus === 'paused') {
        await resumeEnrollment.mutateAsync({ enrollmentId })
        toast({ title: 'Enrollment resumed' })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update enrollment.',
        variant: 'destructive',
      })
    }
  }

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.[0] || ''
    const last = lastName?.[0] || ''
    return (first + last).toUpperCase() || '??'
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'subscribed':
        return <Badge className="bg-green-100 text-green-700">Subscribed</Badge>
      case 'unsubscribed':
        return <Badge className="bg-red-100 text-red-700">Unsubscribed</Badge>
      case 'bounced':
        return <Badge className="bg-orange-100 text-orange-700">Bounced</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-700">Unknown</Badge>
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  if (contactLoading) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    )
  }

  if (!contact) return null

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-blue-100 text-blue-600 text-lg font-semibold">
                  {getInitials(contact.first_name, contact.last_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <SheetTitle className="text-xl">
                  {contact.first_name} {contact.last_name}
                </SheetTitle>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusBadge(contact.subscription_status)}
                </div>
              </div>
            </div>
            {onEdit && (
              <Button variant="outline" size="sm" onClick={() => onEdit(contact)}>
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="deals">Deals</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Last Contacted Card */}
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Send className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-muted-foreground">LAST CONTACTED</span>
                  </div>
                  <span
                    className={cn(
                      'font-semibold text-sm',
                      lastContactedAt ? 'text-green-700' : 'text-orange-600'
                    )}
                  >
                    {lastContactedAt
                      ? formatTimeAgo(lastContactedAt).toUpperCase()
                      : 'NEVER CONTACTED'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {contact.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                      {contact.email}
                    </a>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{contact.phone}</span>
                  </div>
                )}
                {(contact.city || contact.state || contact.country) && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {[contact.city, contact.state, contact.country].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Football Information */}
            {(contact.position || contact.club_name || contact.gpa || contact.graduation_year) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Football Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {contact.graduation_year && (
                    <div className="flex items-center gap-3 text-sm">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      <span>Class of {contact.graduation_year}</span>
                    </div>
                  )}
                  {contact.position && (
                    <div className="flex items-center gap-3 text-sm">
                      <Trophy className="h-4 w-4 text-muted-foreground" />
                      <span>{contact.position}</span>
                    </div>
                  )}
                  {contact.club_name && (
                    <div className="flex items-center gap-3 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{contact.club_name}</span>
                    </div>
                  )}
                  {contact.gpa && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">GPA:</span> {contact.gpa}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Parent/Guardian */}
            {(contact.parent_name || contact.parent_email || contact.parent_phone) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Parent/Guardian</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {contact.parent_name && <p>{contact.parent_name}</p>}
                  {contact.parent_email && (
                    <a href={`mailto:${contact.parent_email}`} className="text-blue-600 hover:underline block">
                      {contact.parent_email}
                    </a>
                  )}
                  {contact.parent_phone && <p className="text-muted-foreground">{contact.parent_phone}</p>}
                </CardContent>
              </Card>
            )}

            {/* Lists Section */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <ListIcon className="h-4 w-4" />
                    LISTS
                  </CardTitle>
                  <Popover open={isAddListOpen} onOpenChange={setIsAddListOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
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
                        <div className="max-h-48 overflow-y-auto">
                          {availableLists.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">
                              {listSearchQuery ? 'No lists found' : 'Contact is in all lists'}
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {availableLists.slice(0, 10).map((list) => (
                                <button
                                  key={list.id}
                                  onClick={() => handleAddToList(list.id, list.name)}
                                  disabled={addToList.isPending}
                                  className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-slate-100 disabled:opacity-50 flex items-center justify-between"
                                >
                                  <span className="truncate">{list.name}</span>
                                  {addToList.isPending && (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </CardHeader>
              <CardContent>
                {listsLoading ? (
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-28" />
                  </div>
                ) : lists.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Not in any lists yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {lists.map((list) => (
                      <Badge
                        key={list.id}
                        variant="secondary"
                        className="bg-slate-100 text-slate-700 pr-1 group"
                      >
                        {list.name}
                        <button
                          onClick={() => handleRemoveFromList(list.id, list.name)}
                          disabled={removeFromList.isPending}
                          className="ml-1 p-0.5 rounded-full hover:bg-slate-200 opacity-60 hover:opacity-100 transition-opacity disabled:opacity-30"
                          title="Remove from list"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Automations Section */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    AUTOMATIONS
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {automationsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : automations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Not enrolled in any automations.</p>
                ) : (
                  <div className="space-y-2">
                    {automations.map((enrollment) => {
                      const automationName = enrollment.automation?.name || 'Unknown Automation'
                      const canManage = enrollment.status === 'active' || enrollment.status === 'paused'

                      return (
                        <div
                          key={enrollment.id}
                          className={cn(
                            'flex items-start justify-between p-2 rounded-lg border',
                            enrollment.status === 'paused'
                              ? 'bg-amber-50/50 border-amber-200'
                              : 'bg-slate-50'
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">
                                {automationName}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px] px-1.5',
                                  enrollment.status === 'active'
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : enrollment.status === 'paused'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : enrollment.status === 'completed'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-gray-50 text-gray-700 border-gray-200'
                                )}
                              >
                                {enrollment.status === 'active' && (
                                  <Zap className="h-2.5 w-2.5 mr-0.5" />
                                )}
                                {enrollment.status === 'paused' && (
                                  <Pause className="h-2.5 w-2.5 mr-0.5" />
                                )}
                                {enrollment.status === 'completed' && (
                                  <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                                )}
                                {enrollment.status === 'stopped' && (
                                  <StopCircle className="h-2.5 w-2.5 mr-0.5" />
                                )}
                                {enrollment.status.charAt(0).toUpperCase() + enrollment.status.slice(1)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              {enrollment.current_step && (
                                <span>
                                  Step {enrollment.current_step.step_order}: {enrollment.current_step.step_name}
                                </span>
                              )}
                              {enrollment.status === 'active' && enrollment.next_step_at && (
                                <span className="flex items-center gap-1 text-amber-600">
                                  <Clock className="h-3 w-3" />
                                  Next: {formatRelativeTime(enrollment.next_step_at)}
                                </span>
                              )}
                            </div>
                            {enrollment.deal && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                Deal: {enrollment.deal.title}
                              </div>
                            )}
                          </div>
                          {canManage && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {enrollment.status === 'active' && (
                                  <DropdownMenuItem
                                    onClick={() => handlePauseResumeAutomation(enrollment.id, 'active')}
                                  >
                                    <Pause className="h-4 w-4 mr-2" />
                                    Pause
                                  </DropdownMenuItem>
                                )}
                                {enrollment.status === 'paused' && (
                                  <DropdownMenuItem
                                    onClick={() => handlePauseResumeAutomation(enrollment.id, 'paused')}
                                  >
                                    <Play className="h-4 w-4 mr-2" />
                                    Resume
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => handleUnenrollFromAutomation(enrollment.id, automationName)}
                                  className="text-red-600"
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Unenroll
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Calendly Events Section */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  CALENDLY EVENTS
                </CardTitle>
              </CardHeader>
              <CardContent>
                {calendlyEventsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : calendlyEvents.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    <p>No Calendly events yet.</p>
                    <p className="text-xs mt-1">
                      Events appear automatically when meetings are scheduled via Calendly.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Upcoming Events */}
                    {calendlyEvents
                      .filter((event) => event.status === 'scheduled' && new Date(event.start_time) > new Date())
                      .map((event) => (
                        <div
                          key={event.id}
                          className="flex items-start justify-between p-2 rounded-lg bg-green-50 border border-green-200"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">
                                {event.event_name}
                              </span>
                              <Badge variant="outline" className="text-[10px] px-1.5 bg-green-100 text-green-700 border-green-300">
                                <CalendarCheck className="h-2.5 w-2.5 mr-0.5" />
                                Upcoming
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(event.start_time)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(event.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {event.location && (
                                <span>{event.location}</span>
                              )}
                            </div>
                            {event.user && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                Host: {event.user.full_name || event.user.email}
                              </div>
                            )}
                          </div>
                          {event.join_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0 h-7 text-xs"
                              asChild
                            >
                              <a href={event.join_url} target="_blank" rel="noopener noreferrer">
                                <Video className="h-3 w-3 mr-1" />
                                Join
                                <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            </Button>
                          )}
                        </div>
                      ))}

                    {/* Past/Completed Events */}
                    {calendlyEvents
                      .filter((event) => event.status === 'completed' || (event.status === 'scheduled' && new Date(event.start_time) <= new Date()))
                      .slice(0, 3) // Show only last 3
                      .map((event) => (
                        <div
                          key={event.id}
                          className="flex items-start justify-between p-2 rounded-lg bg-slate-50"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate text-muted-foreground">
                                {event.event_name}
                              </span>
                              <Badge variant="outline" className="text-[10px] px-1.5 bg-blue-50 text-blue-700 border-blue-200">
                                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                                Completed
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatDate(event.start_time)}
                            </div>
                          </div>
                        </div>
                      ))}

                    {/* Cancelled Events */}
                    {calendlyEvents
                      .filter((event) => event.status === 'cancelled')
                      .slice(0, 2) // Show only last 2
                      .map((event) => (
                        <div
                          key={event.id}
                          className="flex items-start justify-between p-2 rounded-lg bg-red-50/50 border border-red-100"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate text-muted-foreground line-through">
                                {event.event_name}
                              </span>
                              <Badge variant="outline" className="text-[10px] px-1.5 bg-red-50 text-red-600 border-red-200">
                                <XCircle className="h-2.5 w-2.5 mr-0.5" />
                                Cancelled
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatDate(event.start_time)}
                              {event.cancellation_reason && (
                                <span className="ml-2">- {event.cancellation_reason}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deals Tab */}
          <TabsContent value="deals" className="mt-4">
            {dealsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : deals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No deals found for this contact.
              </div>
            ) : (
              <div className="space-y-3">
                {deals.map((deal) => (
                  <Card key={deal.id} className="cursor-pointer hover:bg-gray-50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{deal.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {deal.pipeline?.name} - {deal.stage?.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(deal.deal_value || 0)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(deal.created_at)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="mt-4">
            {/* Log Reply Button */}
            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsLogReplyOpen(true)}
                disabled={!contact?.email}
              >
                <MessageCircle className="h-4 w-4 mr-1.5" />
                Log Reply
              </Button>
            </div>

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
            <Textarea
              placeholder="Add a note..."
              rows={3}
              disabled
            />
            <Button disabled className="w-full">
              Save Note (coming soon)
            </Button>

            <div className="text-center py-8 text-muted-foreground text-sm">
              Note history will appear here.
            </div>
          </TabsContent>
        </Tabs>

        {/* Log Reply Modal */}
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
