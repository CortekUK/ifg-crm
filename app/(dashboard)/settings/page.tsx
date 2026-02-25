'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'
import { SettingsNav, navItems } from '@/components/settings/SettingsNav'
import { cn } from '@/lib/utils'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { ProfileSettings } from '@/components/settings/ProfileSettings'
import { GeneralSettings } from '@/components/settings/GeneralSettings'
import { PipelineManagementSettings } from '@/components/settings/PipelineManagementSettings'
import { IntegrationsSettings } from '@/components/settings/IntegrationsSettings'
import { CalendlySettings } from '@/components/settings/CalendlySettings'
import { EmailSettingsSection } from '@/components/settings/EmailSettingsSection'
import { SMSSettingsSection } from '@/components/settings/SMSSettingsSection'
import { NotificationsSettings } from '@/components/settings/NotificationsSettings'
import { CustomFieldsSettings } from '@/components/settings/CustomFieldsSettings'
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
      case 'custom-fields':
        return <CustomFieldsSettings />
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

      {/* Mobile Navigation — horizontal scrollable tabs */}
      <div className="lg:hidden">
        <ScrollArea className="w-full">
          <div className="flex gap-1 pb-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeSection === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              )
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Two Column Layout — sidebar hidden on mobile */}
      <div className="flex gap-6">
        {/* Left Navigation — desktop only */}
        <Card className="hidden lg:block w-64 p-4 h-fit shrink-0">
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
