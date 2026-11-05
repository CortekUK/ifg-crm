'use client'

import { Lock } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { ReadableMailbox } from '@/lib/hooks/useMailbox'

interface MailboxSelectorProps {
  mailboxes: ReadableMailbox[]
  value: string
  onChange: (userId: string) => void
}

/**
 * Which mailbox am I looking at?
 *
 * A super admin can open any recruiter's mailbox; everyone else only has
 * their own (272 decides, in the database). One mailbox at a time and always
 * opening on your own: the old version opened on "All mailboxes" merged into
 * one list, which is why Nathan disconnected in October.
 *
 * With nothing to choose between it stays a label, because "can anyone else
 * see this?" is the question people ask of this screen.
 */
export function MailboxSelector({ mailboxes, value, onChange }: MailboxSelectorProps) {
  if (mailboxes.length < 2) {
    return (
      <div className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm">
        <Lock className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-slate-400">Mailbox</span>
        <span className="font-medium text-slate-200">Only you</span>
      </div>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="text-sm text-slate-400">Mailbox</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-56 border-slate-800 bg-slate-900/60 text-slate-100">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {mailboxes.map((m) => (
            <SelectItem key={m.user_id} value={m.user_id}>
              {m.is_mine ? 'My mailbox' : m.full_name || m.mailbox_email || 'Recruiter'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
