'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { labelForFormId } from '@/lib/forms/forms-config'
import type { FormSubmission } from '@/lib/types/forms'
import { User, Briefcase, Zap, UserCheck, AlertTriangle, ExternalLink } from 'lucide-react'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_CLASSES: Record<string, string> = {
  processed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  skipped: 'bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400',
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/60 last:border-0">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-right text-foreground break-words">{children}</span>
    </div>
  )
}

export function FormSubmissionDetailSheet({
  submission,
  isOpen,
  onClose,
}: {
  submission: FormSubmission | null
  isOpen: boolean
  onClose: () => void
}) {
  const s = submission
  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {s && (
          <>
            <SheetHeader className="border-b">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="font-normal">{labelForFormId(s.form_id)}</Badge>
                <Badge className={cn('capitalize border-transparent', STATUS_CLASSES[s.status])}>{s.status}</Badge>
              </div>
              <SheetTitle className="text-lg">Form submission</SheetTitle>
            </SheetHeader>

            <div className="p-4 space-y-6">
              {s.status === 'failed' && s.error_message && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{s.error_message}</span>
                </div>
              )}

              {/* What it created */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Outcome</h3>
                <div className="rounded-lg border divide-y">
                  <LinkRow icon={<User className="h-4 w-4" />} label="Contact"
                    href={s.contact_id ? `/contacts?id=${s.contact_id}` : null}
                    value={s.contact ? `${s.contact.first_name} ${s.contact.last_name}`.trim() : '—'} />
                  <LinkRow icon={<Briefcase className="h-4 w-4" />} label="Deal"
                    href={null}
                    value={s.deal?.title ?? '—'} />
                  <LinkRow icon={<Zap className="h-4 w-4" />} label="Automation"
                    href={null}
                    value={s.automation?.name ?? '—'} />
                  <LinkRow icon={<UserCheck className="h-4 w-4" />} label="Assigned to"
                    href={null}
                    value={s.assigned_user?.full_name ?? '—'} />
                </div>
              </div>

              {/* Meta */}
              <div className="space-y-1">
                <h3 className="text-sm font-semibold mb-2">Details</h3>
                <Row label="Form ID">{s.form_id}</Row>
                <Row label="Source">{s.form_source ?? '—'}</Row>
                <Row label="Submitted">{fmtDate(s.created_at)}</Row>
                <Row label="Processed">{fmtDate(s.processed_at)}</Row>
                {s.processing_time_ms != null && <Row label="Processing">{s.processing_time_ms} ms</Row>}
              </div>

              {/* Raw payload */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Submitted data</h3>
                <pre className="rounded-lg border bg-muted/40 p-3 text-xs overflow-x-auto whitespace-pre-wrap break-words">
                  {JSON.stringify(s.payload, null, 2)}
                </pre>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function LinkRow({ icon, label, value, href }: { icon: ReactNode; label: string; value: string; href: string | null }) {
  const inner = (
    <div className="flex items-center justify-between gap-3 p-3">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</span>
      <span className="flex items-center gap-1 text-sm font-medium text-foreground text-right">
        {value}
        {href && value !== '—' && <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />}
      </span>
    </div>
  )
  if (href && value !== '—') {
    return <Link href={href} className="block hover:bg-muted/50 transition-colors">{inner}</Link>
  }
  return inner
}
