'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Inbox, Link2Off, PenSquare, Reply, Send, Users } from 'lucide-react'
import type { MailFolder } from '@/lib/outlook/classify-sender'

export interface FolderCount {
  total: number
  unread: number
  /** What the badge shows — see FOLDER_BADGE in useMailbox. */
  badge: number
}

interface MailRailProps {
  folder: MailFolder
  onFolderChange: (folder: MailFolder) => void
  counts: Record<string, FolderCount>
  onCompose: () => void
}

/**
 * Five folders, each answering a question somebody actually asks.
 *
 * Internal and External are gone: one held mail between colleagues, which is
 * not what this screen is for, and neither ever contained a single thread.
 * "Waiting on you" is new, and is the answer to "where do I see the replies I
 * still owe someone" — the question the rail could not answer before.
 *
 * Badge colour carries meaning and is the same rule everywhere: BLUE is
 * unread, AMBER is a queue of work where every row needs a person whether it
 * has been read or not.
 */
const FOLDERS: {
  id: MailFolder
  label: string
  icon: React.ElementType
  tone: 'unread' | 'work'
}[] = [
  { id: 'inbox', label: 'Inbox', icon: Inbox, tone: 'unread' },
  { id: 'waiting', label: 'Waiting on you', icon: Reply, tone: 'work' },
  { id: 'unmatched', label: 'Not linked', icon: Link2Off, tone: 'work' },
  { id: 'matched', label: 'Contacts', icon: Users, tone: 'unread' },
  { id: 'sent', label: 'Sent', icon: Send, tone: 'unread' },
]

export function MailRail({ folder, onFolderChange, counts, onCompose }: MailRailProps) {
  return (
    <aside className="flex w-56 shrink-0 flex-col gap-4 p-3">
      <Button
        onClick={onCompose}
        className="h-12 w-full justify-start gap-3 rounded-2xl bg-white text-slate-900 shadow-sm hover:bg-slate-100"
      >
        <PenSquare className="h-4 w-4" />
        Compose
      </Button>

      <nav className="space-y-0.5">
        {FOLDERS.map(({ id, label, icon: Icon, tone }) => {
          const active = folder === id
          const count = counts[id]?.badge ?? 0
          return (
            <button
              key={id}
              onClick={() => onFolderChange(id)}
              title={
                tone === 'work'
                  ? `${count} conversation${count === 1 ? '' : 's'} needing attention`
                  : `${count} unread`
              }
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-blue-600/15 font-medium text-blue-300'
                  : 'text-slate-300 hover:bg-slate-800/60',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums',
                    tone === 'work'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-blue-500/20 text-blue-300',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* The three figures that used to sit here — Received, Positive,
          Negative, for today — read 0 / 0 / 0 on any ordinary day, which
          looks like a fault rather than a quiet morning. The folder badges
          above carry the same information and move. */}
      <div className="mt-auto px-1 pb-1">
        <p className="text-[11px] leading-relaxed text-slate-600">
          Blue is unread. Amber needs you.
        </p>
      </div>
    </aside>
  )
}
