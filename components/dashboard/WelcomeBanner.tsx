'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, Send } from 'lucide-react'

interface WelcomeBannerProps {
  onNewLead?: () => void
}

export function WelcomeBanner({ onNewLead }: WelcomeBannerProps) {
  return (
    <div 
      className="rounded-lg p-6 mb-6"
      style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)' }}
    >
      <div className="flex items-center justify-between">
        <p className="text-base text-white">
          <span className="font-semibold">Welcome back!</span>
          <span className="text-white/80 ml-2">Manage recruitment performance at a glance.</span>
        </p>
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
