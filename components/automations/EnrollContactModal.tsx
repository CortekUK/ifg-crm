'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Loader2, Users, UserPlus } from 'lucide-react'
import { useAvailableDealsForEnrollment, useEnrollInAutomation } from '@/lib/hooks/useAutomations'
import { toast } from '@/lib/hooks/use-toast'
import type { Automation } from '@/lib/types/automations'

interface EnrollContactModalProps {
  isOpen: boolean
  onClose: () => void
  automation: Automation | null
}

interface DealContact {
  id: string
  first_name: string
  last_name: string
  email: string
}

interface DealWithContact {
  id: string
  title: string
  contact?: DealContact | DealContact[] | null
}

export function EnrollContactModal({
  isOpen,
  onClose,
  automation,
}: EnrollContactModalProps) {
  const [search, setSearch] = useState('')
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set())

  const { data: deals = [], isLoading: dealsLoading } = useAvailableDealsForEnrollment(
    automation?.id || null,
    automation?.pipeline_id || null
  )
  const enrollInAutomation = useEnrollInAutomation()

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearch('')
      setSelectedDealIds(new Set())
    }
  }, [isOpen])

  // Helper to get contact from deal (handles array response from Supabase)
  const getContact = (deal: DealWithContact): DealContact | null => {
    if (!deal.contact) return null
    return Array.isArray(deal.contact) ? deal.contact[0] : deal.contact
  }

  // Filter deals by search
  const filteredDeals = deals.filter((deal) => {
    const dealData = deal as DealWithContact
    const contact = getContact(dealData)
    const searchLower = search.toLowerCase()

    if (dealData.title.toLowerCase().includes(searchLower)) return true
    if (contact) {
      const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase()
      if (fullName.includes(searchLower)) return true
      if (contact.email?.toLowerCase().includes(searchLower)) return true
    }
    return false
  })

  const handleToggleDeal = (dealId: string) => {
    setSelectedDealIds((prev) => {
      const next = new Set(prev)
      if (next.has(dealId)) {
        next.delete(dealId)
      } else {
        next.add(dealId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedDealIds.size === filteredDeals.length) {
      setSelectedDealIds(new Set())
    } else {
      setSelectedDealIds(new Set(filteredDeals.map((d) => d.id)))
    }
  }

  const handleEnroll = async () => {
    if (!automation || selectedDealIds.size === 0) return

    try {
      // Enroll each selected deal
      const promises = Array.from(selectedDealIds).map((dealId) =>
        enrollInAutomation.mutateAsync({
          automationId: automation.id,
          dealId,
        })
      )

      await Promise.all(promises)

      toast({
        title: 'Contacts enrolled',
        description: `${selectedDealIds.size} contact${selectedDealIds.size > 1 ? 's' : ''} enrolled in "${automation.name}".`,
      })

      onClose()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to enroll contacts.',
        variant: 'destructive',
      })
    }
  }

  const getInitials = (deal: DealWithContact) => {
    const contact = getContact(deal)
    if (contact) {
      return `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase()
    }
    return deal.title.slice(0, 2).toUpperCase()
  }

  const getName = (deal: DealWithContact) => {
    const contact = getContact(deal)
    return contact
      ? `${contact.first_name} ${contact.last_name}`
      : deal.title
  }

  const getEmail = (deal: DealWithContact) => {
    const contact = getContact(deal)
    return contact?.email || deal.title
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
            Enroll in Automation
          </DialogTitle>
          <DialogDescription>
            Select contacts to enroll in "{automation?.name}".
            {automation?.pipeline && (
              <span className="block mt-1 text-xs">
                Showing deals from: {automation.pipeline.name}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Selection count */}
        {selectedDealIds.size > 0 && (
          <div className="flex items-center justify-between py-2">
            <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              {selectedDealIds.size} selected
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDealIds(new Set())}
              className="text-xs"
            >
              Clear selection
            </Button>
          </div>
        )}

        {/* Deals List */}
        <div className="flex-1 overflow-y-auto border rounded-lg min-h-[200px] max-h-[300px]">
          {dealsLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredDeals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Users className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm text-muted-foreground text-center">
                {search
                  ? 'No contacts found matching your search.'
                  : deals.length === 0
                  ? 'All contacts in this pipeline are already enrolled.'
                  : 'No contacts available.'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {/* Select All */}
              {filteredDeals.length > 0 && (
                <div
                  className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer border-b bg-slate-50 dark:bg-slate-800"
                  onClick={handleSelectAll}
                >
                  <Checkbox
                    checked={selectedDealIds.size === filteredDeals.length && filteredDeals.length > 0}
                  />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Select all ({filteredDeals.length})
                  </span>
                </div>
              )}

              {/* Deal Items */}
              {filteredDeals.map((deal) => {
                const dealData = deal as DealWithContact
                return (
                  <div
                    key={dealData.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleToggleDeal(dealData.id)}
                  >
                    <Checkbox checked={selectedDealIds.has(dealData.id)} />
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs">
                        {getInitials(dealData)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {getName(dealData)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {getEmail(dealData)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter className="pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleEnroll}
            disabled={selectedDealIds.size === 0 || enrollInAutomation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {enrollInAutomation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enrolling...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Enroll {selectedDealIds.size > 0 ? selectedDealIds.size : ''} Contact{selectedDealIds.size !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
