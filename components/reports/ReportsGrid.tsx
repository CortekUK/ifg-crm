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
} from 'lucide-react'
import { ReportCard } from './ReportCard'
import { useToast } from '@/lib/hooks/use-toast'

const reports = [
  {
    id: 'contacts-export',
    icon: Users,
    name: 'Contacts Export',
    description: 'Export all contacts with their details and tags.',
    format: 'CSV',
    lastGenerated: '28/01/2026',
  },
  {
    id: 'pipeline-report',
    icon: GitBranch,
    name: 'Pipeline Report',
    description: 'Summary of all deals by pipeline and stage.',
    format: 'CSV/PDF',
    lastGenerated: '25/01/2026',
  },
  {
    id: 'revenue-report',
    icon: PoundSterling,
    name: 'Revenue Report',
    description: 'Financial summary including invoices and payments.',
    format: 'CSV/PDF',
    lastGenerated: '20/01/2026',
  },
  {
    id: 'campaign-performance',
    icon: Send,
    name: 'Campaign Performance',
    description: 'Email and SMS campaign metrics and engagement.',
    format: 'CSV/PDF',
    lastGenerated: undefined,
  },
  {
    id: 'recruiter-performance',
    icon: UserCheck,
    name: 'Recruiter Performance',
    description: 'Individual recruiter statistics and conversions.',
    format: 'CSV/PDF',
    lastGenerated: '15/01/2026',
  },
  {
    id: 'monthly-summary',
    icon: Calendar,
    name: 'Monthly Summary',
    description: 'Comprehensive monthly activity report.',
    format: 'PDF',
    lastGenerated: '01/01/2026',
  },
  {
    id: 'automation-report',
    icon: Zap,
    name: 'Automation Report',
    description: 'Automation performance and completion rates.',
    format: 'CSV',
    lastGenerated: undefined,
  },
  {
    id: 'sms-email-responses',
    icon: MessageSquare,
    name: 'SMS/Email Responses',
    description: 'All inbound messages with intent analysis.',
    format: 'CSV',
    lastGenerated: '27/01/2026',
  },
  {
    id: 'invoice-ageing',
    icon: Clock,
    name: 'Invoice Ageing Report',
    description: 'Unpaid invoices grouped by age (0-30, 30-60, 60-90, 90+ days).',
    format: 'CSV/PDF',
    lastGenerated: undefined,
  },
  {
    id: 'sms-campaign-costs',
    icon: Coins,
    name: 'SMS Campaign Costs',
    description: 'SMS campaign cost tracking and breakdown by campaign.',
    format: 'CSV',
    lastGenerated: undefined,
  },
  {
    id: 'deposit-conversion',
    icon: TrendingUp,
    name: 'Deposit Conversion Rate',
    description: 'Track deposit-to-enrolment conversion rates by programme.',
    format: 'CSV/PDF',
    lastGenerated: undefined,
  },
]

interface ReportsGridProps {
  onGenerateReport: (reportId: string) => void
}

export function ReportsGrid({ onGenerateReport }: ReportsGridProps) {
  const { toast } = useToast()

  const handleGenerate = (reportId: string) => {
    onGenerateReport(reportId)
  }

  const handleDownload = (reportId: string) => {
    toast({
      title: 'Download started',
      description: 'Your report will download shortly.',
    })
    console.log('Downloading report:', reportId)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {reports.map((report) => (
        <ReportCard
          key={report.id}
          icon={report.icon}
          name={report.name}
          description={report.description}
          format={report.format}
          lastGenerated={report.lastGenerated}
          onGenerate={() => handleGenerate(report.id)}
          onDownload={
            report.lastGenerated ? () => handleDownload(report.id) : undefined
          }
        />
      ))}
    </div>
  )
}
