'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import { formatDate, formatCurrency, formatDateLong } from '@/lib/utils/format'
import { usePlayer, usePlayerDeals } from '@/lib/hooks/usePlayers'

interface PlayerDetailSheetProps {
  playerId: string | null
  isOpen: boolean
  onClose: () => void
}

const getAvatarColour = (name: string) => {
  const colours = ['bg-blue-600', 'bg-green-600', 'bg-purple-600', 'bg-orange-600', 'bg-pink-600', 'bg-teal-600', 'bg-indigo-600', 'bg-red-600']
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colours[hash % colours.length]
}

export function PlayerDetailSheet({ playerId, isOpen, onClose }: PlayerDetailSheetProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const { data: player, isLoading } = usePlayer(playerId)
  const { data: deals = [] } = usePlayerDeals(playerId)

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
                  <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900">
                    {fullName}
                  </SheetTitle>
                  <SheetDescription className="mt-1 flex items-center gap-2 flex-wrap">
                    {player.position && <span>{player.position}</span>}
                    {player.position && player.graduation_year && <span>•</span>}
                    {player.graduation_year && <span>Class of {player.graduation_year}</span>}
                  </SheetDescription>
                  <Badge className={player.subscription_status === 'active' ? 'bg-green-100 text-green-700 border-0 mt-2' : 'bg-slate-100 text-slate-700 border-0 mt-2'}>
                    {player.subscription_status === 'active' ? 'Active' : 'Unsubscribed'}
                  </Badge>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <Button variant="outline" className="w-full" asChild>
                  <a href={`mailto:${player.email}`}>
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </a>
                </Button>
                <Button variant="outline" className="w-full" asChild={!!player.phone} disabled={!player.phone}>
                  {player.phone ? (
                    <a href={`tel:${player.phone}`}>
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </a>
                  ) : (
                    <>
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </>
                  )}
                </Button>
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
                  <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm">
                    Docs
                  </TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="px-6 py-6 space-y-6 mt-0">
                  {/* Contact Information */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
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
                      <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
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
                    <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
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

                  {/* Notes */}
                  {player.notes && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                        Notes
                      </h3>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{player.notes}</p>
                    </div>
                  )}
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
                        <div key={deal.id} className="p-4 rounded-lg border bg-white" style={{ borderLeftWidth: 4, borderLeftColor: deal.stage?.color || '#e2e8f0' }}>
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
                  <div className="text-center py-12">
                    <Activity className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-500">Activity timeline coming soon.</p>
                  </div>
                </TabsContent>

                {/* Documents Tab */}
                <TabsContent value="documents" className="px-6 py-6 mt-0">
                  <div className="text-center py-12">
                    <FileText className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-500 mb-4">No documents uploaded yet.</p>
                    <Button variant="outline" disabled>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Document
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Footer */}
            <SheetFooter className="border-t px-6 py-4 bg-slate-50 shrink-0">
              <Button variant="outline" onClick={onClose} className="w-full">
                Close
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
