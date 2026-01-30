'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  GraduationCap,
  Building2,
  User,
  FileText,
  Upload,
  GitBranch,
  Activity,
} from 'lucide-react'
import { formatDate, formatCurrency, formatDateLong } from '@/lib/utils/format'
import { usePlayer, usePlayerDeals } from '@/lib/hooks/usePlayers'
import type { Player } from '@/lib/types/players'

interface PlayerDetailSheetProps {
  playerId: string | null
  isOpen: boolean
  onClose: () => void
}

// Generate consistent colour based on name
const getAvatarColour = (name: string) => {
  const colours = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-red-500',
  ]
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colours[hash % colours.length]
}

export function PlayerDetailSheet({
  playerId,
  isOpen,
  onClose,
}: PlayerDetailSheetProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const { data: player, isLoading } = usePlayer(playerId)
  const { data: deals = [] } = usePlayerDeals(playerId)

  if (!player && !isLoading) return null

  const fullName = player ? `${player.first_name} ${player.last_name}` : ''
  const initials = player
    ? `${player.first_name?.[0] || ''}${player.last_name?.[0] || ''}`.toUpperCase()
    : ''
  const avatarColour = getAvatarColour(fullName)

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-xl">
        {isLoading || !player ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className={`${avatarColour} text-white text-xl font-medium`}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <SheetTitle className="text-xl">{fullName}</SheetTitle>
                  <SheetDescription className="flex items-center gap-2 mt-1">
                    {player.position && <span>{player.position}</span>}
                    {player.position && player.graduation_year && <span>•</span>}
                    {player.graduation_year && <span>Class of {player.graduation_year}</span>}
                  </SheetDescription>
                  <Badge
                    className={
                      player.subscription_status === 'active'
                        ? 'bg-green-100 text-green-700 mt-2'
                        : 'bg-gray-100 text-gray-700 mt-2'
                    }
                  >
                    {player.subscription_status === 'active' ? 'Active' : 'Unsubscribed'}
                  </Badge>
                </div>
              </div>
            </SheetHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="deals">Deals</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="documents">Docs</TabsTrigger>
              </TabsList>

              <ScrollArea className="h-[calc(100vh-280px)] mt-4">
                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4 mt-0">
                  {/* Contact Information */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Contact Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{player.email}</span>
                      </div>
                      {player.phone && (
                        <div className="flex items-center gap-3">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{player.phone}</span>
                        </div>
                      )}
                      {(player.city || player.state || player.country) && (
                        <div className="flex items-center gap-3">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {[player.city, player.state, player.country].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}
                      {player.date_of_birth && (
                        <div className="flex items-center gap-3">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{formatDateLong(player.date_of_birth)}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Parent/Guardian */}
                  {(player.parent_name || player.parent_email || player.parent_phone) && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Parent/Guardian
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        {player.parent_name && (
                          <div className="flex items-center gap-3">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{player.parent_name}</span>
                          </div>
                        )}
                        {player.parent_email && (
                          <div className="flex items-center gap-3">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{player.parent_email}</span>
                          </div>
                        )}
                        {player.parent_phone && (
                          <div className="flex items-center gap-3">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{player.parent_phone}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Academic & Club */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <GraduationCap className="h-4 w-4" />
                        Academic & Club
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {player.graduation_year && (
                        <div className="flex items-center gap-3">
                          <GraduationCap className="h-4 w-4 text-muted-foreground" />
                          <span>Class of {player.graduation_year}</span>
                        </div>
                      )}
                      {player.gpa && (
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span>GPA: {player.gpa.toFixed(2)}</span>
                        </div>
                      )}
                      {player.club_name && (
                        <div className="flex items-center gap-3">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{player.club_name}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Notes */}
                  {player.notes && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Notes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {player.notes}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Deals Tab */}
                <TabsContent value="deals" className="space-y-4 mt-0">
                  {deals.length === 0 ? (
                    <div className="text-center py-8">
                      <GitBranch className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                      <p className="text-muted-foreground">No deals for this player yet.</p>
                    </div>
                  ) : (
                    deals.map((deal) => (
                      <Card key={deal.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">{deal.pipeline?.name || 'Unknown Pipeline'}</p>
                              <Badge
                                style={{ backgroundColor: deal.stage?.color }}
                                className="mt-1 text-white"
                              >
                                {deal.stage?.name || 'Unknown Stage'}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{formatCurrency(deal.deal_value)}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {deal.owner?.full_name || 'Unassigned'}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                {/* Activity Tab */}
                <TabsContent value="activity" className="space-y-4 mt-0">
                  <div className="text-center py-8">
                    <Activity className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-muted-foreground">Activity timeline coming soon.</p>
                  </div>
                </TabsContent>

                {/* Documents Tab */}
                <TabsContent value="documents" className="space-y-4 mt-0">
                  <div className="text-center py-8">
                    <FileText className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-muted-foreground mb-4">No documents uploaded yet.</p>
                    <Button variant="outline" disabled>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Document
                    </Button>
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
