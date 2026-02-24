'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Download, Trash2, Shield, AlertTriangle } from 'lucide-react'

export function DataPrivacySettings() {
  const handleExportData = () => {
    console.log('Exporting all data...')
  }

  const handleDeleteAccount = () => {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      console.log('Deleting account...')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Data & Privacy</h2>
        <p className="text-sm text-muted-foreground">
          Manage your data and privacy preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-5 w-5" />
            GDPR Compliance
          </CardTitle>
          <CardDescription>
            Information about how we handle your data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We are committed to protecting your privacy and complying with GDPR regulations.
            Your data is stored securely in the EU and is never shared with third parties
            without your explicit consent.
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
              <p className="font-medium text-gray-900 dark:text-white">Data Location</p>
              <p className="text-muted-foreground">EU (Ireland)</p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
              <p className="font-medium text-gray-900 dark:text-white">Encryption</p>
              <p className="text-muted-foreground">AES-256 at rest</p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
              <p className="font-medium text-gray-900 dark:text-white">Retention Period</p>
              <p className="text-muted-foreground">As per your settings</p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
              <p className="font-medium text-gray-900 dark:text-white">Data Processing</p>
              <p className="text-muted-foreground">GDPR Article 6(1)(b)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export Data</CardTitle>
          <CardDescription>
            Download a copy of all your data in a machine-readable format.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You can request a full export of your data at any time. The export will include
            all contacts, deals, communications, and settings associated with your account.
          </p>
          <Button variant="outline" onClick={handleExportData}>
            <Download className="h-4 w-4 mr-2" />
            Export All Data
          </Button>
          <p className="text-xs text-muted-foreground">
            Export will be prepared and sent to your email address. This may take a few minutes.
          </p>
        </CardContent>
      </Card>

      <Card className="border-red-200 dark:border-red-800">
        <CardHeader>
          <CardTitle className="text-base text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions that affect your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Delete Account</AlertTitle>
            <AlertDescription>
              Once you delete your account, there is no going back. All your data will be
              permanently removed. Please be certain.
            </AlertDescription>
          </Alert>
          <Button variant="destructive" onClick={handleDeleteAccount}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Account
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
