'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Save } from 'lucide-react'

export function EmailSettingsSection() {
  const [settings, setSettings] = useState({
    defaultFromName: 'IFG Team',
    defaultFromEmail: 'hello@ifg-crm.com',
    replyToEmail: 'support@ifg-crm.com',
    emailSignature: `Best regards,
The IFG Team

International Football Group
www.ifg-crm.com`,
    unsubscribeFooter: 'If you no longer wish to receive these emails, click here to unsubscribe.',
  })

  const handleChange = (field: string, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    console.log('Saving email settings:', settings)
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
            />
            <p className="text-xs text-muted-foreground">
              Required for compliance. The unsubscribe link will be automatically added.
            </p>
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
