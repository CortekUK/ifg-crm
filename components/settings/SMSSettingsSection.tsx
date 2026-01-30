'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Save } from 'lucide-react'

export function SMSSettingsSection() {
  const [settings, setSettings] = useState({
    defaultSMSNumber: '+44 7XXX XXX001',
    smsSignature: '- IFG Team',
    characterLimitWarning: 140,
  })

  const handleChange = (field: string, value: string | number) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    console.log('Saving SMS settings:', settings)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">SMS Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure default SMS settings for campaigns and automations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sender Information</CardTitle>
          <CardDescription>
            Default sender details for outgoing SMS messages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="defaultSMSNumber">Default SMS Number</Label>
            <Input
              id="defaultSMSNumber"
              value={settings.defaultSMSNumber}
              onChange={(e) => handleChange('defaultSMSNumber', e.target.value)}
              placeholder="+44 7XXX XXX XXX"
            />
            <p className="text-xs text-muted-foreground">
              The phone number that will appear as the sender.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SMS Content</CardTitle>
          <CardDescription>
            Default content settings for SMS messages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="smsSignature">SMS Signature</Label>
            <Input
              id="smsSignature"
              value={settings.smsSignature}
              onChange={(e) => handleChange('smsSignature', e.target.value)}
              placeholder="- Your Name"
            />
            <p className="text-xs text-muted-foreground">
              Short signature appended to SMS messages.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="characterLimitWarning">Character Limit Warning</Label>
            <Input
              id="characterLimitWarning"
              type="number"
              value={settings.characterLimitWarning}
              onChange={(e) => handleChange('characterLimitWarning', parseInt(e.target.value))}
              min={1}
              max={160}
            />
            <p className="text-xs text-muted-foreground">
              Show a warning when SMS content exceeds this character count. Standard SMS limit is 160 characters.
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
