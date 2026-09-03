'use client'

// The report catalogue, grouped by the job each report does.
//
// The list is generated from `lib/reports/catalogue.ts`, which the API
// route also reads — so a report cannot appear here without a runner
// behind it, which is how the previous grid ended up offering three
// reports that threw on every run.

import {
  Users,
  GitBranch,
  PoundSterling,
  Send,
  UserCheck,
  Calendar,
  Zap,
  MessageSquare,
  Clock,
  FileText,
  TrendingUp,
  Target,
  Mail,
  BookOpen,
  Route,
  Tags,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react'
import { ReportCard } from './ReportCard'
import { REPORTS, REPORT_CATEGORIES } from '@/lib/reports/catalogue'

const icons: Record<string, LucideIcon> = {
  deals: GitBranch,
  'stage-movements': Route,
  recruiters: UserCheck,
  'monthly-summary': Calendar,
  payments: PoundSterling,
  invoices: FileText,
  'invoice-ageing': Clock,
  'deposit-conversion': TrendingUp,
  campaigns: Send,
  'campaign-conversions': Target,
  'email-sends': Mail,
  'email-replies': MessageSquare,
  'brochure-leads': BookOpen,
  contacts: Users,
  'form-submissions': ClipboardList,
  automations: Zap,
  audience: Tags,
}

interface ReportsGridProps {
  onGenerateReport: (reportId: string) => void
}

export function ReportsGrid({ onGenerateReport }: ReportsGridProps) {
  return (
    <div className="space-y-7">
      {REPORT_CATEGORIES.map((category) => {
        const reports = REPORTS.filter((r) => r.category === category.id)
        if (reports.length === 0) return null

        return (
          <section key={category.id}>
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {category.label}
              </h2>
              <p className="text-xs text-muted-foreground">{category.description}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {reports.map((report) => (
                <ReportCard
                  key={report.id}
                  icon={icons[report.id] ?? FileText}
                  name={report.name}
                  description={report.description}
                  onGenerate={() => onGenerateReport(report.id)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
