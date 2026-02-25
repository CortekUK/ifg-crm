'use client'

import { cn } from '@/lib/utils'
import {
  Settings,
  Plug,
  Mail,
  MessageSquare,
  Bell,
  Shield,
  User,
  Calendar,
  GitBranch,
  SlidersHorizontal,
} from 'lucide-react'
import type { SettingsSection } from '@/lib/types/settings'

interface SettingsNavProps {
  activeSection: SettingsSection
  onSectionChange: (section: SettingsSection) => void
}

export const navItems: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'My Profile', icon: User },
  { id: 'general', label: 'General', icon: Settings },
  { id: 'pipelines', label: 'Pipelines', icon: GitBranch },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'calendly', label: 'Calendly', icon: Calendar },
  { id: 'email', label: 'Email Settings', icon: Mail },
  { id: 'sms', label: 'SMS Settings', icon: MessageSquare },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'custom-fields', label: 'Custom Fields', icon: SlidersHorizontal },
  { id: 'data', label: 'Data & Privacy', icon: Shield },
]

export function SettingsNav({ activeSection, onSectionChange }: SettingsNavProps) {
  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = activeSection === item.id

        return (
          <button
            key={item.id}
            onClick={() => onSectionChange(item.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left',
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            <Icon className="h-5 w-5" />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
