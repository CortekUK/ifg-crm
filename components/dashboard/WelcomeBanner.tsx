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

  // "Send Campaign" points at an admin-only route, so for a recruiter it was
  // a button that led to /unauthorized.
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

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
    
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-sm sm:text-base text-white">
          {isLoading ? (
            <span className="inline-block h-5 w-48 bg-white/20 rounded animate-pulse" />
          ) : (
            <>
              <span className="font-semibold">Welcome back{firstName ? `, ${firstName}` : ''}!</span>
              <span className="text-white/80 ml-1 block sm:inline mt-1 sm:mt-0">Manage recruitment performance at a glance.</span>
            </>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="border-white/30 text-white hover:bg-white/10 hover:text-white bg-transparent"
            onClick={onNewLead}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Lead
          </Button>
          {isAdmin && (
            <Link href="/campaigns">
              <Button
                variant="outline"
                size="sm"
                className="border-white/30 text-white hover:bg-white/10 hover:text-white bg-transparent"
              >
                <Send className="h-4 w-4 mr-1.5" />
                Send Campaign
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
