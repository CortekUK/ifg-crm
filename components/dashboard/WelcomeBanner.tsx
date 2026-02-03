'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, Send } from 'lucide-react'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'

interface WelcomeBannerProps {
  onNewLead?: () => void
}

export function WelcomeBanner({ onNewLead }: WelcomeBannerProps) {
  const { data: user, isLoading } = useCurrentUser()

  // Extract first name from full_name or email
  const getFirstName = () => {
    if (!user) return ''
    if (user.full_name) {
      return user.full_name.split(' ')[0]
    }
    if (user.email) {
      return user.email.split('@')[0]
    }
    return ''
  }

  const firstName = getFirstName()

  return (
    <div className="rounded-lg p-6 mb-6 banner-gradient">
    
      <div className="flex items-center justify-between">
        <div className="text-base text-white">
          {isLoading ? (
            <span className="inline-block h-5 w-48 bg-white/20 rounded animate-pulse" />
          ) : (
            <>
              <span className="font-semibold">Welcome back{firstName ? `, ${firstName}` : ''}!</span>
              <span className="text-white/80 ml-2">Manage recruitment performance at a glance.</span>
            </>
          )}
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10 hover:text-white bg-transparent"
            onClick={onNewLead}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Lead
          </Button>
          <Link href="/campaigns">
            <Button
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10 hover:text-white bg-transparent"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Campaign
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
