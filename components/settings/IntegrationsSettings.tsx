'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CheckCircle, XCircle, Eye, EyeOff, Copy, Plus } from 'lucide-react'

export function IntegrationsSettings() {
  const [showClickSendKey, setShowClickSendKey] = useState(false)
  const [showResendKey, setShowResendKey] = useState(false)

  const phoneNumberMappings = [
    { phoneNumber: '+44 7XXX XXX001', pipelineName: 'UCLan 2026' },
    { phoneNumber: '+44 7XXX XXX002', pipelineName: 'Salford 2026' },
  ]

  const verifiedDomains = ['ifg-crm.com', 'email.ifg-crm.com']

  const webhookUrl = 'https://api.ifg-crm.com/webhooks/stripe'

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Connect external services to extend your CRM functionality.
        </p>
      </div>

      {/* Click Send */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">ClickSend (SMS)</CardTitle>
              <CardDescription>
                Send and receive SMS messages through ClickSend.
              </CardDescription>
            </div>
            <Badge className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clicksendUsername">API Username</Label>
              <Input
                id="clicksendUsername"
                placeholder="your-username"
                defaultValue="ifg_admin"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clicksendKey">API Key</Label>
              <div className="relative">
                <Input
                  id="clicksendKey"
                  type={showClickSendKey ? 'text' : 'password'}
                  placeholder="••••••••••••••••"
                  defaultValue="sk_live_xxxxxxxxxxxx"
                />
                <button
                  type="button"
                  onClick={() => setShowClickSendKey(!showClickSendKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showClickSendKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <Button variant="outline" size="sm">
            Test Connection
          </Button>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Phone Number Mappings</Label>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Mapping
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Pipeline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {phoneNumberMappings.map((mapping, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono">{mapping.phoneNumber}</TableCell>
                    <TableCell>{mapping.pipelineName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Resend */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Resend (Email)</CardTitle>
              <CardDescription>
                Send transactional and marketing emails through Resend.
              </CardDescription>
            </div>
            <Badge className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resendKey">API Key</Label>
            <div className="relative">
              <Input
                id="resendKey"
                type={showResendKey ? 'text' : 'password'}
                placeholder="••••••••••••••••"
                defaultValue="re_xxxxxxxxxxxx"
              />
              <button
                type="button"
                onClick={() => setShowResendKey(!showResendKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showResendKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Verified Domains</Label>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Domain
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {verifiedDomains.map((domain) => (
                <Badge key={domain} variant="secondary">
                  <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                  {domain}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stripe */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Stripe (Payments)</CardTitle>
              <CardDescription>
                Accept payments and manage subscriptions through Stripe.
              </CardDescription>
            </div>
            <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 dark:text-gray-300">
              <XCircle className="h-3 w-3 mr-1" />
              Not Connected
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button>Connect with Stripe</Button>

          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-sm" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(webhookUrl)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Add this URL to your Stripe webhook settings.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Xero */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Xero (Accounting)</CardTitle>
              <CardDescription>
                Sync invoices and payments with your Xero account.
              </CardDescription>
            </div>
            <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 dark:text-gray-300">
              <XCircle className="h-3 w-3 mr-1" />
              Not Connected
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Button>Connect with Xero</Button>
        </CardContent>
      </Card>
    </div>
  )
}
