'use client'

import { useState } from 'react'
import { ReportsPageHeader } from '@/components/reports/ReportsPageHeader'
import { ReportsGrid } from '@/components/reports/ReportsGrid'
import { GenerateReportModal } from '@/components/reports/GenerateReportModal'

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <ReportsPageHeader />

      <ReportsGrid onGenerateReport={setSelectedReport} />

      <GenerateReportModal
        reportId={selectedReport}
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
      />
    </div>
  )
}
