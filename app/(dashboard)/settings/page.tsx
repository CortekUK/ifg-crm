'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { ProfileSettings } from '@/components/settings/ProfileSettings'
import { GeneralSettings } from '@/components/settings/GeneralSettings'
import { PipelineManagementSettings } from '@/components/settings/PipelineManagementSettings'
import { IntegrationsSettings } from '@/components/settings/IntegrationsSettings'
import { CalendlySettings } from '@/components/settings/CalendlySettings'
import { EmailSettingsSection } from '@/components/settings/EmailSettingsSection'
import { SMSSettingsSection } from '@/components/settings/SMSSettingsSection'
import { NotificationsSettings } from '@/components/settings/NotificationsSettings'
import { DataPrivacySettings } from '@/components/settings/DataPrivacySettings'
import type { SettingsSection } from '@/lib/types/settings'

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile')

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return <ProfileSettings />
      case 'general':
        return <GeneralSettings />
      case 'pipelines':
        return <PipelineManagementSettings />
      case 'integrations':
        return <IntegrationsSettings />
      case 'calendly':
        return <CalendlySettings />
      case 'email':
        return <EmailSettingsSection />
      case 'sms':
        return <SMSSettingsSection />
      case 'notifications':
        return <NotificationsSettings />
      case 'data':
        return <DataPrivacySettings />
      default:
        return <ProfileSettings />
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <SettingsPageHeader />

      {/* Two Column Layout */}
      <div className="flex gap-6">
        {/* Left Navigation */}
        <Card className="w-64 p-4 h-fit shrink-0">
          <SettingsNav
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />
        </Card>

        {/* Right Content */}
        <div className="flex-1 min-w-0">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
