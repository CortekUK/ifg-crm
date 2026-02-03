'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Upload, Save } from 'lucide-react'

export function GeneralSettings() {
  const [settings, setSettings] = useState({
    companyName: 'International Football Group',
    defaultCurrency: 'GBP',
    timezone: 'Europe/London',
    dateFormat: 'DD/MM/YYYY',
  })

  const handleChange = (field: string, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    console.log('Saving general settings:', settings)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">General Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure basic settings for your CRM.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organisation Details</CardTitle>
          <CardDescription>
            Basic information about your organisation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              value={settings.companyName}
              onChange={(e) => handleChange('companyName', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                <span className="text-lg font-bold text-gray-400">IFG</span>
              </div>
              <Button variant="outline" disabled>
                <Upload className="h-4 w-4 mr-2" />
                Upload Logo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Recommended size: 200x200px. Max file size: 2MB.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regional Settings</CardTitle>
          <CardDescription>
            Configure currency, timezone, and date format preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Default Currency</Label>
              <Select
                value={settings.defaultCurrency}
                onValueChange={(v) => handleChange('defaultCurrency', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GBP">£ GBP (British Pound)</SelectItem>
                  <SelectItem value="USD">$ USD (US Dollar)</SelectItem>
                  <SelectItem value="EUR">€ EUR (Euro)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={settings.timezone}
                onValueChange={(v) => handleChange('timezone', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Europe/London">Europe/London (GMT/BST)</SelectItem>
                  <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                  <SelectItem value="America/Los_Angeles">America/Los_Angeles (PST)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Date Format</Label>
            <Select
              value={settings.dateFormat}
              onValueChange={(v) => handleChange('dateFormat', v)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (29/01/2026)</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (01/29/2026)</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2026-01-29)</SelectItem>
              </SelectContent>
            </Select>
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
