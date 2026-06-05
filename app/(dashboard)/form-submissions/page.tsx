'use client'

import { useState, useMemo, useEffect, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TablePagination } from '@/components/ui/table-pagination'
import { FormSubmissionsTable } from '@/components/form-submissions/FormSubmissionsTable'
import { FormSubmissionDetailSheet } from '@/components/form-submissions/FormSubmissionDetailSheet'
import { useFormSubmissions, useFormSubmissionStats } from '@/lib/hooks/useFormSubmissions'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { FORM_LABELS } from '@/lib/forms/forms-config'
import type { FormSubmission, FormSubmissionFilters, FormSubmissionStatus } from '@/lib/types/forms'
import { Search, Inbox, CheckCircle2, AlertTriangle, CalendarClock, Loader2 } from 'lucide-react'

function StatCard({ label, value, icon, isLoading, accent }: {
  label: string; value: number; icon: ReactNode; isLoading: boolean; accent: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>{icon}</div>
      <div>
        {isLoading ? <Skeleton className="h-7 w-12" /> : <div className="text-2xl font-bold leading-none">{value}</div>}
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </div>
    </div>
  )
}

export default function FormSubmissionsPage() {
  const router = useRouter()
  const { data: currentUser, isLoading: userLoading } = useCurrentUser()
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  const [search, setSearch] = useState('')
  const [formId, setFormId] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [selected, setSelected] = useState<FormSubmission | null>(null)

  // Non-admins get bounced (defence in depth — middleware also guards the route).
  useEffect(() => {
    if (!userLoading && currentUser && !isAdmin) router.replace('/contacts')
  }, [userLoading, currentUser, isAdmin, router])

  const filters: FormSubmissionFilters = useMemo(() => ({
    ...(formId !== 'all' && { form_id: formId }),
    ...(status !== 'all' && { status: status as FormSubmissionStatus }),
  }), [formId, status])

  const { data: submissions = [], isLoading } = useFormSubmissions(filters)
  const { data: stats, isLoading: statsLoading } = useFormSubmissionStats()

  // Client-side text search over submitter name / email.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return submissions
    return submissions.filter((s) => {
      const p = s.payload as Record<string, unknown>
      const hay = [
        s.contact?.first_name, s.contact?.last_name, s.contact?.email,
        p.firstName, p.first_name, p.lastName, p.last_name, p.email,
      ].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [submissions, search])

  const handlePageSizeChange = useCallback((n: number) => { setPageSize(n); setPage(1) }, [])

  if (userLoading || (currentUser && !isAdmin)) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Form Submissions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every application submitted through the website — who submitted, what it created, and the raw data.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total submissions" value={stats?.total ?? 0} isLoading={statsLoading}
          icon={<Inbox className="h-5 w-5 text-blue-600" />} accent="bg-blue-100 dark:bg-blue-500/15" />
        <StatCard label="Processed" value={stats?.processed ?? 0} isLoading={statsLoading}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} accent="bg-emerald-100 dark:bg-emerald-500/15" />
        <StatCard label="Failed" value={stats?.failed ?? 0} isLoading={statsLoading}
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />} accent="bg-red-100 dark:bg-red-500/15" />
        <StatCard label="Today" value={stats?.todayCount ?? 0} isLoading={statsLoading}
          icon={<CalendarClock className="h-5 w-5 text-violet-600" />} accent="bg-violet-100 dark:bg-violet-500/15" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or email…" className="pl-9" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <Select value={formId} onValueChange={(v) => { setFormId(v); setPage(1) }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All forms" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All forms</SelectItem>
            {Object.entries(FORM_LABELS).map(([id, label]) => (
              <SelectItem key={id} value={id}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="processed">Processed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <FormSubmissionsTable
        submissions={filtered}
        isLoading={isLoading}
        onView={setSelected}
        page={page}
        pageSize={pageSize}
      />

      {filtered.length > 0 && (
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          label="submissions"
        />
      )}

      <FormSubmissionDetailSheet
        submission={selected}
        isOpen={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
