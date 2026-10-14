'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AlertCircle, Mail, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOutlookStatus } from '@/lib/hooks/useOutlook'

/**
 * "Set up your Outlook" — the prompt for anyone whose mailbox isn't connected.
 *
 * It sits at the top of the mailbox and nowhere else: this is the only screen
 * where a missing connection explains what you are looking at. An empty Inbox
 * with no explanation reads as a broken page, which is exactly the report that
 * came back from the client about the Replies screen.
 *
 * Renders nothing at all once a mailbox is connected, and nothing while the
 * status is still loading, so it cannot flash on for users who are fine.
 */
export function OutlookBanner() {
  const { data: status, isLoading } = useOutlookStatus()
  const [dismissed, setDismissed] = useState(false)

  if (isLoading || !status || status.connected || dismissed) return null

  const needsReconnect = status.status === 'reconnect_needed'

  // An unconfigured deployment is an administrator's job, not this user's, so
  // they get an explanation rather than a button that cannot work.
  if (!status.configured) {
    return (
      <div className="flex items-start gap-3 border-b border-amber-500/20 bg-amber-500/5 px-5 py-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="text-sm">
          <p className="font-medium text-amber-200">Outlook isn&apos;t set up on this CRM yet.</p>
          <p className="text-slate-400">
            An administrator needs to add the Microsoft credentials before mailboxes can be connected.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 border-b px-5 py-3',
        needsReconnect
          ? 'border-amber-500/20 bg-amber-500/5'
          : 'border-blue-500/20 bg-blue-500/5',
      )}
    >
      {needsReconnect ? (
        <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
      ) : (
        <Mail className="h-4 w-4 shrink-0 text-blue-400" />
      )}

      <div className="min-w-0 flex-1 text-sm">
        <span className={cn('font-medium', needsReconnect ? 'text-amber-200' : 'text-blue-200')}>
          {needsReconnect ? 'Your Outlook connection has stopped working' : 'Set up your Outlook'}
        </span>
        <span className="text-slate-400">
          {needsReconnect
            ? ' — this usually follows a Microsoft password change. Reconnect to start receiving mail again; nothing already here is lost.'
            : ' — connect your mailbox to send and receive email from here. Your sent mail still appears in Outlook, and replies land in both places.'}
        </span>
      </div>

      <Button
        asChild
        size="sm"
        className={cn(
          'shrink-0',
          needsReconnect
            ? 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
            : 'bg-blue-600 text-white hover:bg-blue-700',
        )}
      >
        <Link href="/settings?section=outlook">
          {needsReconnect ? 'Reconnect Outlook' : 'Set up Outlook'}
        </Link>
      </Button>

      {!needsReconnect && (
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 text-slate-500 hover:text-slate-300"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
