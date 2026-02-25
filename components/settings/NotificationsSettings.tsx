'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Save, Loader2 } from 'lucide-react'
import { useSettings } from '@/lib/hooks/useSettings'
import { toast } from '@/lib/hooks/use-toast'

interface NotificationSettingsData {
  emailNotifications: {
    newLead: boolean
    smsReply: boolean
    emailReply: boolean
    paymentReceived: boolean
    dealWon: boolean
  }
  browserNotifications: boolean
}

const defaults: NotificationSettingsData = {
  emailNotifications: {
    newLead: true,
    smsReply: true,
    emailReply: true,
    paymentReceived: true,
    dealWon: true,
  },
  browserNotifications: false,
}

export function NotificationsSettings() {
  const { data: saved, isLoading, save, isSaving } = useSettings<NotificationSettingsData>('notifications')
  const [settings, setSettings] = useState<NotificationSettingsData>(defaults)

  useEffect(() => {
    if (saved) setSettings(saved)
  }, [saved])

  const handleEmailNotificationChange = (key: string, value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      emailNotifications: {
        ...prev.emailNotifications,
        [key]: value,
      },
    }))
  }

  const handleSave = async () => {
    try {
      await save(settings)
      toast({ title: 'Settings saved', description: 'Notification settings have been updated.' })
    } catch {
      toast({ title: 'Failed to save', description: 'Could not save settings. Please try again.', variant: 'destructive' })
    }
  }

  const emailNotificationItems = [
    { key: 'newLead', label: 'New lead received', description: 'When a new lead is added to a pipeline' },
    { key: 'smsReply', label: 'SMS reply received', description: 'When an incoming SMS is received' },
    { key: 'emailReply', label: 'Email reply received', description: 'When an email reply is received' },
    { key: 'paymentReceived', label: 'Payment received', description: 'When a payment is recorded' },
    { key: 'dealWon', label: 'Deal won', description: 'When a deal is marked as won' },
  ]

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
          <CardTitle className="text-base">Email Notifications</CardTitle>
          <CardDescription>
            Receive email alerts for important events.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailNotificationItems.map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <Label htmlFor={item.key} className="cursor-pointer">
                  {item.label}
                </Label>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Switch
                id={item.key}
                checked={settings.emailNotifications[item.key as keyof typeof settings.emailNotifications]}
                onCheckedChange={(checked) => handleEmailNotificationChange(item.key, checked)}
                disabled={isLoading}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Browser Notifications</CardTitle>
          <CardDescription>
            Receive real-time notifications in your browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="browserNotifications" className="cursor-pointer">
                Enable browser notifications
              </Label>
              <p className="text-xs text-muted-foreground">
                You&apos;ll need to allow notifications in your browser settings.
              </p>
            </div>
            <Switch
              id="browserNotifications"
              checked={settings.browserNotifications}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, browserNotifications: checked }))
              }
              disabled={isLoading}
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
