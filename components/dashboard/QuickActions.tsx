'use client'

// The things people come here to start. Everything else is a page away
// through the sidebar; these are the ones worth one click from the front door.
//
// Three of the four used to be campaigns, templates and brochures — all
// admin-only routes, so for a recruiter three quarters of this row led to
// /unauthorized.

import Link from 'next/link'
import { BookOpen, FileText, MessageSquare, Send, UserPlus } from 'lucide-react'

export function QuickActions({
  onNewContact,
  isAdmin,
}: {
  onNewContact: () => void
  isAdmin: boolean
}) {
  const cls =
    'flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-blue-400 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-blue-400'

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={onNewContact} className={cls}>
        <UserPlus className="h-4 w-4" />
        New contact
      </button>
      <Link href="/replies" className={cls}>
        <MessageSquare className="h-4 w-4" />
        Replies
      </Link>
      {isAdmin && (
        <>
          <Link href="/campaigns" className={cls}>
            <Send className="h-4 w-4" />
            New campaign
          </Link>
          <Link href="/templates/editor" className={cls}>
            <FileText className="h-4 w-4" />
            New template
          </Link>
          <Link href="/brochures" className={cls}>
            <BookOpen className="h-4 w-4" />
            Brochures
          </Link>
        </>
      )}
    </div>
  )
}
