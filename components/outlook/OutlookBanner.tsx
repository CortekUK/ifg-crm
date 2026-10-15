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
 * It rides on every CRM page, not just the mailbox, and stays until the
 * mailbox is connected. A disconnected mailbox is not a problem you notice by
 * visiting the mailbox: mail stops arriving, replies stop being recorded
 * against contacts, and the screens where that matters — a contact, a deal,
 * the pipeline — look exactly as they always did. The one place the absence
 * was announced was the one place you only open if you already knew.
 *
 * Renders nothing once a mailbox is connected, and nothing while the status
 * is still loading, so it cannot flash on for users who are fine.
 */
export function OutlookBanner({ tone = 'crm' }: { tone?: 'crm' | 'dark' }) {
  const { data: status, isLoading } = useOutlookStatus()
  const [dismissed, setDismissed] = useState(false)

  if (isLoading || !status || status.connected) return null

  const needsReconnect = status.status === 'reconnect_needed'

  // A broken connection is never dismissible — it is losing mail right now.
  // The first-time prompt can be put away for the session.
  if (dismissed && !needsReconnect) return null

  const dark = tone === 'dark'

  // An unconfigured deployment is an administrator's job, not this user's, so
  // they get an explanation rather than a button that cannot work. Only on
  // the mailbox itself: a recruiter looking at a contact can do nothing about
  // it, and a bar on every page saying so is noise.
  if (!status.configured) {
    if (!dark) return null
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
        'flex items-center gap-3 border-b px-4 py-2 md:px-6',
        dark
          ? needsReconnect
            ? 'border-amber-500/20 bg-amber-500/5'
            : 'border-blue-500/20 bg-blue-500/5'
          : needsReconnect
            ? 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40'
            : 'border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/40',
      )}
    >
      {needsReconnect ? (
        <AlertCircle className={cn('h-4 w-4 shrink-0', dark ? 'text-amber-400' : 'text-amber-600 dark:text-amber-400')} />
      ) : (
        <Mail className={cn('h-4 w-4 shrink-0', dark ? 'text-blue-400' : 'text-blue-600 dark:text-blue-400')} />
      )}

      <div className="min-w-0 flex-1 text-sm">
        <span
          className={cn(
            'font-medium',
            dark
              ? needsReconnect ? 'text-amber-200' : 'text-blue-200'
              : needsReconnect
                ? 'text-amber-900 dark:text-amber-200'
                : 'text-blue-900 dark:text-blue-200',
          )}
        >
          {needsReconnect ? 'Your Outlook connection has stopped working' : 'Set up your Outlook'}
        </span>
        <span className={cn('hidden sm:inline', dark ? 'text-slate-400' : 'text-muted-foreground')}>
          {needsReconnect
            ? ' — mail has stopped arriving in the CRM. This usually follows a Microsoft password change; nothing already here is lost.'
            : ' — connect your mailbox to send and receive email from here. Your sent mail still appears in Outlook, and replies land in both places.'}
        </span>
      </div>

      <Button
        asChild
        size="sm"
        className={cn(
          'h-7 shrink-0',
          needsReconnect
            ? 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
            : 'bg-blue-600 text-white hover:bg-blue-700',
        )}
      >
        <Link href="/settings?section=outlook">
          {needsReconnect ? 'Reconnect' : 'Set up Outlook'}
        </Link>
      </Button>

      {!needsReconnect && (
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className={cn('shrink-0', dark ? 'text-slate-500 hover:text-slate-300' : 'text-muted-foreground hover:text-foreground')}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
