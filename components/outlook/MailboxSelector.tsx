'use client'

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Lock } from 'lucide-react'
import type { MailboxScope } from '@/lib/hooks/useMailbox'

interface MailboxSelectorProps {
  isAdmin: boolean
  scope: MailboxScope
  onChange: (scope: MailboxScope) => void
  owners: { id: string; full_name: string | null; email: string; role: string }[]
}

/**
 * Which mailboxes am I looking at?
 *
 * Only an admin gets a choice. A recruiter sees a locked label instead of a
 * disabled dropdown, because a control you can open but not use reads as
 * broken — and this one would imply other mailboxes are a click away when the
 * database will not return them either way.
 */
export function MailboxSelector({ isAdmin, scope, onChange, owners }: MailboxSelectorProps) {
  if (!isAdmin) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm">
        <Lock className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-slate-400">Mailbox</span>
        <span className="font-medium text-slate-200">My mailbox</span>
      </div>
    )
  }

  const recruiters = owners.filter((o) => o.role === 'recruiter')

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-400">Mailbox</span>
      <Select value={scope} onValueChange={(v) => onChange(v as MailboxScope)}>
        <SelectTrigger className="h-9 w-[190px] border-slate-800 bg-slate-900/60 text-slate-100">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All mailboxes</SelectItem>
          <SelectItem value="mine">My mailbox</SelectItem>
          <SelectItem value="recruiters">All recruiters</SelectItem>
          {recruiters.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.full_name || r.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
