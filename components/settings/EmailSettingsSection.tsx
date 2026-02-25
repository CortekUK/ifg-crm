'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Save, Loader2 } from 'lucide-react'
import { useSettings } from '@/lib/hooks/useSettings'
import { toast } from '@/lib/hooks/use-toast'

interface EmailSettingsData {
  defaultFromName: string
  defaultFromEmail: string
  replyToEmail: string
  emailSignature: string
  unsubscribeFooter: string
}

const defaults: EmailSettingsData = {
  defaultFromName: '',
  defaultFromEmail: '',
  replyToEmail: '',
  emailSignature: '',
  unsubscribeFooter: 'If you no longer wish to receive these emails, click here to unsubscribe.',
}

export function EmailSettingsSection() {
  const { data: saved, isLoading, save, isSaving } = useSettings<EmailSettingsData>('email')
  const [settings, setSettings] = useState<EmailSettingsData>(defaults)

  useEffect(() => {
    if (saved) setSettings(saved)
  }, [saved])

  const handleChange = (field: string, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    try {
      await save(settings)
      toast({ title: 'Settings saved', description: 'Email settings have been updated.' })
    } catch {
      toast({ title: 'Failed to save', description: 'Could not save settings. Please try again.', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Email Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure default email settings for campaigns and automations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sender Information</CardTitle>
          <CardDescription>
            Default sender details for outgoing emails.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="defaultFromName">Default From Name</Label>
              <Input
                id="defaultFromName"
                value={settings.defaultFromName}
                onChange={(e) => handleChange('defaultFromName', e.target.value)}
                placeholder="Your Name or Company"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultFromEmail">Default From Email</Label>
              <Input
                id="defaultFromEmail"
                type="email"
                value={settings.defaultFromEmail}
                onChange={(e) => handleChange('defaultFromEmail', e.target.value)}
                placeholder="hello@example.com"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="replyToEmail">Reply-To Email</Label>
            <Input
              id="replyToEmail"
              type="email"
              value={settings.replyToEmail}
              onChange={(e) => handleChange('replyToEmail', e.target.value)}
              placeholder="support@example.com"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Replies to your emails will be sent to this address.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email Content</CardTitle>
          <CardDescription>
            Default content included in all emails.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="emailSignature">Email Signature</Label>
            <Textarea
              id="emailSignature"
              value={settings.emailSignature}
              onChange={(e) => handleChange('emailSignature', e.target.value)}
              rows={5}
              placeholder="Your email signature..."
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              This signature will be appended to all outgoing emails.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unsubscribeFooter">Unsubscribe Footer</Label>
            <Textarea
              id="unsubscribeFooter"
              value={settings.unsubscribeFooter}
              onChange={(e) => handleChange('unsubscribeFooter', e.target.value)}
              rows={2}
              placeholder="Unsubscribe text..."
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Required for compliance. The unsubscribe link will be automatically added.
            </p>
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
