'use client'

import { Lock } from 'lucide-react'

/**
 * Which mailbox am I looking at? Always your own.
 *
 * This used to be a dropdown for admins — All mailboxes / My mailbox / All
 * recruiters / a named person — defaulting to "All mailboxes". That default is
 * why opening CRM Outlook as an admin showed everyone's mail at once, and why
 * Nathan disconnected his account.
 *
 * Since 265 a connected mailbox is private to the person who connected it, so
 * there is nothing to choose between: the database returns nobody else's mail
 * whatever this asked for. It stays on screen as a statement rather than a
 * control, because "can anyone else see this?" is the question the dropdown
 * made people ask.
 */
export function MailboxSelector() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm">
      <Lock className="h-3.5 w-3.5 text-slate-500" />
      <span className="text-slate-400">Mailbox</span>
      <span className="font-medium text-slate-200">Only you</span>
    </div>
  )
}
