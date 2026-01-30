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
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  Trophy,
  Users,
  Pencil,
  Calendar,
  PoundSterling,
} from 'lucide-react'
import { formatDate, formatRelativeTime } from '@/lib/utils/format'
import { useContact, useContactDeals, useContactActivities, useContactLists } from '@/lib/hooks/useContacts'
import type { Contact } from '@/lib/types/contacts'

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

  const { data: contact, isLoading: contactLoading } = useContact(contactId)
  const { data: deals = [], isLoading: dealsLoading } = useContactDeals(contactId)
  const { data: activities = [], isLoading: activitiesLoading } = useContactActivities(contactId)
  const { data: lists = [] } = useContactLists(contactId)

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

            {/* Lists */}
            {lists.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Lists</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {lists.map((list) => (
                      <Badge key={list.id} variant="outline">
                        {list.name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
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
      </SheetContent>
    </Sheet>
  )
}
