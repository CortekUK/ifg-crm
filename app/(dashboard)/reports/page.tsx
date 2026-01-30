'use client'

import { useState } from 'react'
import { ReportsPageHeader } from '@/components/reports/ReportsPageHeader'
import { ReportsGrid } from '@/components/reports/ReportsGrid'
import { GenerateReportModal } from '@/components/reports/GenerateReportModal'

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null)

  const handleGenerateReport = (reportId: string) => {
    setSelectedReport(reportId)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <ReportsPageHeader />

      {/* Reports Grid */}
      <ReportsGrid onGenerateReport={handleGenerateReport} />

      {/* Generate Report Modal */}
      <GenerateReportModal
        reportId={selectedReport}
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
      />
    </div>
  )
}
