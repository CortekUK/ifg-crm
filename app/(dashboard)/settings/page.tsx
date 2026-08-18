'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'
import { SettingsNav, navItems } from '@/components/settings/SettingsNav'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { cn } from '@/lib/utils'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { ProfileSettings } from '@/components/settings/ProfileSettings'
import { GeneralSettings } from '@/components/settings/GeneralSettings'
import { PipelineManagementSettings } from '@/components/settings/PipelineManagementSettings'
import { IntegrationsSettings } from '@/components/settings/IntegrationsSettings'
import { CalendlySettings } from '@/components/settings/CalendlySettings'
import { EmailSettingsSection } from '@/components/settings/EmailSettingsSection'
import { EmailBrandingSettings } from '@/components/settings/EmailBrandingSettings'
import { SMSSettingsSection } from '@/components/settings/SMSSettingsSection'
import { NotificationsSettings } from '@/components/settings/NotificationsSettings'
import { CustomFieldsSettings } from '@/components/settings/CustomFieldsSettings'
import { DataPrivacySettings } from '@/components/settings/DataPrivacySettings'
import type { SettingsSection } from '@/lib/types/settings'

// Sections a non-admin (recruiter) may manage — their own profile, their
// Calendly connection, and their notification preferences. Everything else is
// org/admin configuration.
const RECRUITER_SECTIONS: SettingsSection[] = ['profile', 'calendly', 'notifications']

function SettingsPageContent() {
  // Deep-link support, e.g. /settings?section=email-branding — the template
  // editor links straight to the branding screen from its locked header and
  // footer regions.
  const requestedSection = useSearchParams().get('section') as SettingsSection | null
  const [activeSection, setActiveSection] = useState<SettingsSection>(
    requestedSection ?? 'profile',
  )
  const { data: currentUser, isLoading: userLoading } = useCurrentUser()

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'
  const visibleNavItems = isAdmin
    ? navItems
    : navItems.filter((item) => RECRUITER_SECTIONS.includes(item.id))

  // Defense-in-depth: a non-admin can only ever render their allowed sections,
  // regardless of activeSection state.
  const safeSection =
    isAdmin || RECRUITER_SECTIONS.includes(activeSection) ? activeSection : 'profile'

  const renderContent = () => {
    switch (safeSection) {
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
      case 'email-branding':
        return <EmailBrandingSettings />
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

  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <SettingsPageHeader />

      {/* Mobile Navigation — horizontal scrollable tabs */}
      <div className="lg:hidden">
        <ScrollArea className="w-full">
          <div className="flex gap-1 pb-2">
            {visibleNavItems.map((item) => {
              const Icon = item.icon
              const isActive = safeSection === item.id
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
            activeSection={safeSection}
            onSectionChange={setActiveSection}
            items={visibleNavItems}
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

// useSearchParams needs a Suspense boundary above it so the route can still
// be prerendered.
export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      }
    >
      <SettingsPageContent />
    </Suspense>
  )
}
