'use client'

import { Mail, Phone, Calendar, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Deal } from '@/lib/types/pipelines'

interface QuickActionsProps {
  deal: Deal
  onEmail?: () => void
  onCall?: () => void
  onSchedule?: () => void
  onView?: () => void
}

export function QuickActions({
  deal,
  onEmail,
  onCall,
  onSchedule,
  onView,
}: QuickActionsProps) {
  const contact = deal.contact
  const hasEmail = !!contact?.email
  const hasPhone = !!contact?.phone
  const hasCalendly = !!deal.owner?.calendly_url

  const handleEmail = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onEmail) {
      onEmail()
    } else if (contact?.email) {
      window.location.href = `mailto:${contact.email}`
    }
  }

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onCall) {
      onCall()
    } else if (contact?.phone) {
      window.location.href = `tel:${contact.phone}`
    }
  }

  const handleSchedule = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onSchedule) {
      onSchedule()
    } else if (deal.owner?.calendly_url) {
      window.open(deal.owner.calendly_url, '_blank')
    }
  }

  const handleView = (e: React.MouseEvent) => {
    e.stopPropagation()
    onView?.()
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-0.5">
        {hasEmail && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md bg-background/80 backdrop-blur-sm hover:bg-primary hover:text-primary-foreground shadow-sm"
                onClick={handleEmail}
              >
                <Mail className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Send email
            </TooltipContent>
          </Tooltip>
        )}

        {hasPhone && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md bg-background/80 backdrop-blur-sm hover:bg-primary hover:text-primary-foreground shadow-sm"
                onClick={handleCall}
              >
                <Phone className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Call {contact?.phone}
            </TooltipContent>
          </Tooltip>
        )}

        {hasCalendly && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md bg-background/80 backdrop-blur-sm hover:bg-primary hover:text-primary-foreground shadow-sm"
                onClick={handleSchedule}
              >
                <Calendar className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Schedule meeting
            </TooltipContent>
          </Tooltip>
        )}

        {onView && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md bg-background/80 backdrop-blur-sm hover:bg-primary hover:text-primary-foreground shadow-sm"
                onClick={handleView}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              View details
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}
