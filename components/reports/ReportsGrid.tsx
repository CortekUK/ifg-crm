'use client'

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
} from 'lucide-react'
import { ReportCard } from './ReportCard'

const reports = [
  {
    id: 'contacts-export',
    icon: Users,
    name: 'Contacts Export',
    description: 'Export all contacts with their details and tags.',
    format: 'CSV',
  },
  {
    id: 'pipeline-report',
    icon: GitBranch,
    name: 'Pipeline Report',
    description: 'Summary of all deals by pipeline and stage.',
    format: 'CSV',
  },
  {
    id: 'revenue-report',
    icon: PoundSterling,
    name: 'Revenue Report',
    description: 'Financial summary including invoices and payments.',
    format: 'CSV',
  },
  {
    id: 'campaign-performance',
    icon: Send,
    name: 'Campaign Performance',
    description: 'Email and SMS campaign metrics and engagement.',
    format: 'CSV',
  },
  {
    id: 'campaign-conversions',
    icon: Target,
    name: 'Campaign Conversions',
    description: 'Track campaign-to-deal conversion rates by pipeline via Smart Process.',
    format: 'CSV',
  },
  {
    id: 'recruiter-performance',
    icon: UserCheck,
    name: 'Recruiter Performance',
    description: 'Individual recruiter statistics and conversions.',
    format: 'CSV',
  },
  {
    id: 'monthly-summary',
    icon: Calendar,
    name: 'Monthly Summary',
    description: 'Comprehensive monthly activity report.',
    format: 'CSV',
  },
  {
    id: 'automation-report',
    icon: Zap,
    name: 'Automation Report',
    description: 'Automation performance and completion rates.',
    format: 'CSV',
  },
  {
    id: 'sms-email-responses',
    icon: MessageSquare,
    name: 'SMS/Email Responses',
    description: 'All inbound messages with intent analysis.',
    format: 'CSV',
  },
  {
    id: 'invoice-ageing',
    icon: Clock,
    name: 'Invoice Ageing Report',
    description: 'Unpaid invoices grouped by age (0-30, 30-60, 60-90, 90+ days).',
    format: 'CSV',
  },
  {
    id: 'sms-campaign-costs',
    icon: Coins,
    name: 'SMS Campaign Costs',
    description: 'SMS campaign cost tracking and breakdown by campaign.',
    format: 'CSV',
  },
  {
    id: 'deposit-conversion',
    icon: TrendingUp,
    name: 'Deposit Conversion Rate',
    description: 'Track deposit-to-enrolment conversion rates by programme.',
    format: 'CSV',
  },
]

interface ReportsGridProps {
  onGenerateReport: (reportId: string) => void
}

export function ReportsGrid({ onGenerateReport }: ReportsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {reports.map((report) => (
        <ReportCard
          key={report.id}
          icon={report.icon}
          name={report.name}
          description={report.description}
          format={report.format}
          onGenerate={() => onGenerateReport(report.id)}
        />
      ))}
    </div>
  )
}
