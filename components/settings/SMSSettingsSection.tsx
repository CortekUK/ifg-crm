'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Save, Loader2 } from 'lucide-react'
import { useSettings } from '@/lib/hooks/useSettings'
import { toast } from '@/lib/hooks/use-toast'

interface SMSSettingsData {
  defaultSMSNumber: string
  smsSignature: string
  characterLimitWarning: number
}

const defaults: SMSSettingsData = {
  defaultSMSNumber: '',
  smsSignature: '- IFG Team',
  characterLimitWarning: 140,
}

export function SMSSettingsSection() {
  const { data: saved, isLoading, save, isSaving } = useSettings<SMSSettingsData>('sms')
  const [settings, setSettings] = useState<SMSSettingsData>(defaults)

  useEffect(() => {
    if (saved) setSettings(saved)
  }, [saved])

  const handleChange = (field: string, value: string | number) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    try {
      await save(settings)
      toast({ title: 'Settings saved', description: 'SMS settings have been updated.' })
    } catch {
      toast({ title: 'Failed to save', description: 'Could not save settings. Please try again.', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">SMS Settings</h2>
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
              disabled={isLoading}
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
              disabled={isLoading}
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
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Show a warning when SMS content exceeds this character count. Standard SMS limit is 160 characters.
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
