'use client'

// Categorised reports grid. The previous design dumped 12 cards into
// a 3-column wall — visually flat, no story for which report belongs
// to which job. We now group them under four category headings
// (Pipeline / Revenue / Marketing / Operations) so the user lands and
// scans by intent rather than by alphabetical accident.

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
  Coins,
  TrendingUp,
  Target,
  type LucideIcon,
} from 'lucide-react'
import { ReportCard } from './ReportCard'

interface ReportDef {
  id: string
  icon: LucideIcon
  name: string
  description: string
}

interface ReportSection {
  label: string
  description: string
  reports: ReportDef[]
}

const sections: ReportSection[] = [
  {
    label: 'Pipeline & people',
    description: 'Sales-team performance and pipeline health.',
    reports: [
      {
        id: 'pipeline-report',
        icon: GitBranch,
        name: 'Pipeline report',
        description: 'Summary of all deals by pipeline and stage.',
      },
      {
        id: 'recruiter-performance',
        icon: UserCheck,
        name: 'Recruiter performance',
        description: 'Individual recruiter statistics and conversions.',
      },
      {
        id: 'monthly-summary',
        icon: Calendar,
        name: 'Monthly summary',
        description: 'Comprehensive monthly activity report.',
      },
    ],
  },
  {
    label: 'Revenue & finance',
    description: 'Where the money is and what is still owed.',
    reports: [
      {
        id: 'revenue-report',
        icon: PoundSterling,
        name: 'Revenue report',
        description: 'Financial summary including invoices and payments.',
      },
      {
        id: 'invoice-ageing',
        icon: Clock,
        name: 'Invoice ageing',
        description: 'Unpaid invoices grouped by age (0–30, 30–60, 60–90, 90+).',
      },
      {
        id: 'deposit-conversion',
        icon: TrendingUp,
        name: 'Deposit conversion rate',
        description: 'Deposit-to-enrolment conversion by programme.',
      },
    ],
  },
  {
    label: 'Marketing',
    description: 'Campaign reach, response, and conversion.',
    reports: [
      {
        id: 'campaign-performance',
        icon: Send,
        name: 'Campaign performance',
        description: 'Email and SMS campaign metrics and engagement.',
      },
      {
        id: 'campaign-conversions',
        icon: Target,
        name: 'Campaign conversions',
        description: 'Campaign-to-deal conversion rates by pipeline.',
      },
      {
        id: 'sms-email-responses',
        icon: MessageSquare,
        name: 'SMS / Email responses',
        description: 'All inbound messages with intent analysis.',
      },
      {
        id: 'sms-campaign-costs',
        icon: Coins,
        name: 'SMS campaign costs',
        description: 'SMS cost tracking, broken down by campaign.',
      },
    ],
  },
  {
    label: 'Operations',
    description: 'Data exports and automation health.',
    reports: [
      {
        id: 'contacts-export',
        icon: Users,
        name: 'Contacts export',
        description: 'Export all contacts with their details and tags.',
      },
      {
        id: 'automation-report',
        icon: Zap,
        name: 'Automation report',
        description: 'Automation performance and completion rates.',
      },
    ],
  },
]

interface ReportsGridProps {
  onGenerateReport: (reportId: string) => void
}

export function ReportsGrid({ onGenerateReport }: ReportsGridProps) {
  return (
    <div className="space-y-7">
      {sections.map((section) => (
        <section key={section.label}>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {section.label}
            </h2>
            <p className="text-xs text-muted-foreground">{section.description}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {section.reports.map((report) => (
              <ReportCard
                key={report.id}
                icon={report.icon}
                name={report.name}
                description={report.description}
                format="CSV"
                onGenerate={() => onGenerateReport(report.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
