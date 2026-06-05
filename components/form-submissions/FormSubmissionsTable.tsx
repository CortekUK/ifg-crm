'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { labelForFormId } from '@/lib/forms/forms-config'
import type { FormSubmission, FormSubmissionStatus } from '@/lib/types/forms'
import { Inbox } from 'lucide-react'

const STATUS_CLASSES: Record<FormSubmissionStatus, string> = {
  processed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  skipped: 'bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400',
}

function submitterName(s: FormSubmission): string {
  if (s.contact && (s.contact.first_name || s.contact.last_name)) {
    return `${s.contact.first_name ?? ''} ${s.contact.last_name ?? ''}`.trim()
  }
  const p = s.payload as Record<string, unknown>
  const fn = (p.firstName ?? p.first_name) as string | undefined
  const ln = (p.lastName ?? p.last_name) as string | undefined
  const name = `${fn ?? ''} ${ln ?? ''}`.trim()
  return name || '—'
}

function submitterEmail(s: FormSubmission): string {
  if (s.contact?.email) return s.contact.email
  const p = s.payload as Record<string, unknown>
  return (p.email as string) || '—'
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function FormSubmissionsTable({
  submissions,
  isLoading,
  onView,
  page,
  pageSize,
}: {
  submissions: FormSubmission[]
  isLoading: boolean
  onView: (s: FormSubmission) => void
  page: number
  pageSize: number
}) {
  const paged = submissions.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Submitter</TableHead>
            <TableHead>Form</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Deal</TableHead>
            <TableHead>Automation</TableHead>
            <TableHead>Assigned to</TableHead>
            <TableHead>Submitted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 7 }).map((__, j) => (
                  <TableCell key={j}><Skeleton className="h-5 w-full max-w-[160px]" /></TableCell>
                ))}
              </TableRow>
            ))
          ) : paged.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7}>
                <div className="flex flex-col items-center justify-center gap-2 py-14 text-center text-muted-foreground">
                  <Inbox className="h-8 w-8" />
                  <p className="text-sm font-medium">No form submissions yet</p>
                  <p className="text-xs">Submissions from the website will appear here as they arrive.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            paged.map((s) => (
              <TableRow key={s.id} className="cursor-pointer" onClick={() => onView(s)}>
                <TableCell>
                  <div className="font-medium text-foreground">{submitterName(s)}</div>
                  <div className="text-xs text-muted-foreground">{submitterEmail(s)}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal">{labelForFormId(s.form_id)}</Badge>
                  {s.form_source && (
                    <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{s.form_source}</div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={cn('capitalize border-transparent', STATUS_CLASSES[s.status])}>{s.status}</Badge>
                </TableCell>
                <TableCell className="max-w-[180px] truncate text-sm">{s.deal?.title ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="max-w-[180px] truncate text-sm">{s.automation?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-sm">{s.assigned_user?.full_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmtDate(s.created_at)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
