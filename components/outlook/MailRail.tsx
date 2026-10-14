'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Globe, Inbox, PenSquare, Send, UserCheck, UserX, Building2 } from 'lucide-react'
import type { MailFolder } from '@/lib/outlook/classify-sender'

interface MailRailProps {
  folder: MailFolder
  onFolderChange: (folder: MailFolder) => void
  counts: Record<string, number>
  today: { received: number; positive: number; negative: number }
  onCompose: () => void
}

const FOLDERS: { id: MailFolder; label: string; icon: React.ElementType }[] = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'unmatched', label: 'Unmatched', icon: UserX },
  { id: 'matched', label: 'Matched', icon: UserCheck },
  { id: 'sent', label: 'Sent', icon: Send },
  { id: 'internal', label: 'Internal', icon: Building2 },
  { id: 'external', label: 'External', icon: Globe },
]

export function MailRail({ folder, onFolderChange, counts, today, onCompose }: MailRailProps) {
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
        {FOLDERS.map(({ id, label, icon: Icon }) => {
          const active = folder === id
          const count = counts[id] ?? 0
          return (
            <button
              key={id}
              onClick={() => onFolderChange(id)}
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
                    'rounded-full px-1.5 py-0.5 text-[11px] font-medium',
                    // Unmatched is amber because it is the only folder that is
                    // a job rather than a record — each one needs a human to
                    // connect it before the history sits on the right player.
                    id === 'unmatched'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'text-slate-400',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="px-1">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Today</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: today.received, label: 'Received', tone: 'text-slate-100' },
            { value: today.positive, label: 'Positive', tone: 'text-green-400' },
            { value: today.negative, label: 'Negative', tone: 'text-red-400' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-800 bg-slate-900/40 px-2 py-2 text-center"
            >
              <p className={cn('text-lg font-semibold leading-none', stat.tone)}>{stat.value}</p>
              <p className="mt-1 text-[10px] text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
