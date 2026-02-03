'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Save } from 'lucide-react'

export function NotificationsSettings() {
  const [settings, setSettings] = useState({
    emailNotifications: {
      newLead: true,
      smsReply: true,
      emailReply: true,
      paymentReceived: true,
      dealWon: true,
    },
    browserNotifications: false,
  })

  const handleEmailNotificationChange = (key: string, value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      emailNotifications: {
        ...prev.emailNotifications,
        [key]: value,
      },
    }))
  }

  const handleSave = () => {
    console.log('Saving notification settings:', settings)
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
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </div>
  )
}
