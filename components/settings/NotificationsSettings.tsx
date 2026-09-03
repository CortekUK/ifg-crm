'use client'

import { useState, useSyncExternalStore } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Save, Loader2, BellRing } from 'lucide-react'
import { useSettings } from '@/lib/hooks/useSettings'
import {
  getServerSnapshot,
  getSnapshot,
  parseSnapshot,
  setPreference,
  subscribe,
} from '@/lib/notifications/browser'
import { toast } from '@/lib/hooks/use-toast'

interface NotificationSettingsData {
  emailNotifications: {
    newLead: boolean
    emailReply: boolean
    paymentReceived: boolean
    dealWon: boolean
  }
}

const defaults: NotificationSettingsData = {
  emailNotifications: {
    newLead: true,
    emailReply: true,
    paymentReceived: true,
    dealWon: true,
  },
}

// Every toggle here gates a real send. The list is deliberately short:
// an "SMS reply" toggle used to sit alongside these, but no SMS is sent
// or received by this CRM, so it could never fire.
const emailNotificationItems: {
  key: keyof NotificationSettingsData['emailNotifications']
  label: string
  description: string
}[] = [
  {
    key: 'newLead',
    label: 'New lead received',
    description: 'When a website form creates a new player and deal.',
  },
  {
    key: 'emailReply',
    label: 'Email reply received',
    description: 'When a player replies to one of your emails.',
  },
  {
    key: 'paymentReceived',
    label: 'Payment received',
    description: 'When Stripe confirms a payment against an invoice.',
  },
  {
    key: 'dealWon',
    label: 'Deal won',
    description: 'When a deal is marked as won in the pipeline.',
  },
]

/**
 * Older saved values carry a `smsReply` key that no longer exists. Reading
 * only the keys we still honour stops a stale row resurrecting a toggle
 * that gates nothing.
 */
function normalise(saved: NotificationSettingsData | null | undefined): NotificationSettingsData {
  if (!saved) return defaults
  return {
    emailNotifications: {
      newLead: saved.emailNotifications?.newLead ?? true,
      emailReply: saved.emailNotifications?.emailReply ?? true,
      paymentReceived: saved.emailNotifications?.paymentReceived ?? true,
      dealWon: saved.emailNotifications?.dealWon ?? true,
    },
  }
}

export function NotificationsSettings() {
  const { data: saved, isLoading, save, isSaving } = useSettings<NotificationSettingsData>('notifications')

  // The saved value is the source of truth until the user edits something;
  // the draft then takes over. Deriving rather than mirroring into state
  // means no effect has to copy one into the other.
  const [draft, setDraft] = useState<NotificationSettingsData | null>(null)
  const settings = draft ?? normalise(saved)

  // Browser alerts are a property of this browser, not of the CRM: the
  // permission belongs to the device and cannot be granted for someone
  // else. Storing it org-wide would mean one admin silencing everyone.
  const { permission, enabled: browserEnabled } = parseSnapshot(
    useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot),
  )

  const handleEmailNotificationChange = (
    key: keyof NotificationSettingsData['emailNotifications'],
    value: boolean,
  ) => {
    setDraft((prev) => {
      const base = prev ?? normalise(saved)
      return {
        ...base,
        emailNotifications: { ...base.emailNotifications, [key]: value },
      }
    })
  }

  const handleBrowserToggle = async (checked: boolean) => {
    if (!checked) {
      setPreference(false)
      return
    }

    if (!('Notification' in window)) {
      toast({
        title: 'Not supported',
        description: 'This browser cannot show desktop notifications.',
        variant: 'destructive',
      })
      return
    }

    const result =
      Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission()

    if (result !== 'granted') {
      setPreference(false)
      toast({
        title: 'Permission not granted',
        description:
          'Your browser blocked notifications. Allow them for this site in your browser settings, then try again.',
        variant: 'destructive',
      })
      return
    }

    setPreference(true)
    new Notification('Notifications are on', {
      body: 'You will see new leads, replies and payments here as they arrive.',
    })
  }

  const handleSave = async () => {
    try {
      await save(settings)
      toast({ title: 'Settings saved', description: 'Notification settings have been updated.' })
    } catch {
      toast({ title: 'Failed to save', description: 'Could not save settings. Please try again.', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Configure how and when you receive notifications.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email alerts</CardTitle>
          <CardDescription>
            Sent to the recruiter who owns the player, or to all admins when nobody owns it.
            These apply to everyone on the team.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailNotificationItems.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor={item.key} className="cursor-pointer">
                  {item.label}
                </Label>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Switch
                id={item.key}
                checked={settings.emailNotifications[item.key]}
                onCheckedChange={(checked) => handleEmailNotificationChange(item.key, checked)}
                disabled={isLoading}
              />
            </div>
          ))}
          <p className="border-t border-slate-200 pt-3 text-xs text-muted-foreground dark:border-slate-700">
            The bell in the top bar is separate: it always shows every CRM event in real time,
            whichever alerts you switch off here.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="h-4 w-4" />
            Desktop notifications
          </CardTitle>
          <CardDescription>
            Pop up a notification on this computer the moment something happens, even when the
            CRM is in a background tab.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="browserNotifications" className="cursor-pointer">
                Enable on this browser
              </Label>
              <p className="text-xs text-muted-foreground">
                {permission === 'unsupported'
                  ? 'This browser does not support desktop notifications.'
                  : permission === 'denied'
                    ? 'Blocked. Allow notifications for this site in your browser settings first.'
                    : 'Applies to this browser only — turn it on again on your other devices.'}
              </p>
            </div>
            <Switch
              id="browserNotifications"
              checked={browserEnabled}
              onCheckedChange={handleBrowserToggle}
              disabled={permission === 'unsupported'}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving || isLoading}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
