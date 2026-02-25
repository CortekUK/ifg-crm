'use client'

import { useState, useEffect } from 'react'
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
import { CheckCircle, XCircle, Eye, EyeOff, Copy, Plus, Globe, FileText, AlertCircle, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react'

interface ResendDomain {
  id: string
  name: string
  status: string
  records: { record: string; status: string }[]
}

export function IntegrationsSettings() {
  const [showClickSendKey, setShowClickSendKey] = useState(false)
  const [showResendKey, setShowResendKey] = useState(false)
  const [resendDomains, setResendDomains] = useState<ResendDomain[]>([])
  const [domainsLoading, setDomainsLoading] = useState(false)

  useEffect(() => {
    setDomainsLoading(true)
    fetch('/api/integrations/resend-domains')
      .then((res) => res.json())
      .then((data) => setResendDomains(data.domains || []))
      .catch(() => {})
      .finally(() => setDomainsLoading(false))
  }, [])

  const phoneNumberMappings: { phoneNumber: string; pipelineName: string }[] = []

  const webhookUrl = ''

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
            <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              <XCircle className="h-3 w-3 mr-1" />
              Not Connected
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clicksendKey">API Key</Label>
              <div className="relative">
                <Input
                  id="clicksendKey"
                  type={showClickSendKey ? 'text' : 'password'}
                  placeholder="••••••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowClickSendKey(!showClickSendKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
                {phoneNumberMappings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground py-6">
                      No phone number mappings configured yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  phoneNumberMappings.map((mapping, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono">{mapping.phoneNumber}</TableCell>
                      <TableCell>{mapping.pipelineName}</TableCell>
                    </TableRow>
                  ))
                )}
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
            <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              <XCircle className="h-3 w-3 mr-1" />
              Not Connected
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
                placeholder="re_xxxxxxxxxxxxxxxx"
              />
              <button
                type="button"
                onClick={() => setShowResendKey(!showResendKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
            {domainsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking domain status...
              </div>
            ) : resendDomains.length === 0 ? (
              <p className="text-sm text-muted-foreground">No verified domains yet.</p>
            ) : (
              <div className="space-y-3">
                {resendDomains.map((domain) => {
                  const isVerified = domain.status === 'verified'
                  const spf = domain.records.find((r) => r.record === 'SPF')
                  const dkim = domain.records.find((r) => r.record === 'DKIM')
                  const dmarc = domain.records.find((r) => r.record === 'DMARC')

                  return (
                    <div key={domain.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isVerified ? (
                            <ShieldCheck className="h-4 w-4 text-green-600" />
                          ) : (
                            <ShieldAlert className="h-4 w-4 text-amber-500" />
                          )}
                          <span className="font-medium text-sm">{domain.name}</span>
                        </div>
                        <Badge variant={isVerified ? 'default' : 'secondary'} className={isVerified ? 'bg-green-100 text-green-700' : ''}>
                          {domain.status}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        {[
                          { label: 'SPF', rec: spf },
                          { label: 'DKIM', rec: dkim },
                          { label: 'DMARC', rec: dmarc },
                        ].map(({ label, rec }) => (
                          <Badge
                            key={label}
                            variant="outline"
                            className={
                              rec?.status === 'verified'
                                ? 'border-green-300 text-green-700 bg-green-50'
                                : rec
                                  ? 'border-amber-300 text-amber-700 bg-amber-50'
                                  : 'border-gray-200 text-gray-400'
                            }
                          >
                            {rec?.status === 'verified' ? (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            ) : (
                              <XCircle className="h-3 w-3 mr-1" />
                            )}
                            {label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
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
            <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
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
            <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              <XCircle className="h-3 w-3 mr-1" />
              Not Connected
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Button>Connect with Xero</Button>
        </CardContent>
      </Card>

      {/* Form Webhooks */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Form Webhooks
              </CardTitle>
              <CardDescription>
                Connect website forms (WordPress/Ninja Forms) to automatically create contacts and deals.
              </CardDescription>
            </div>
            <Badge className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
              <CheckCircle className="h-3 w-3 mr-1" />
              Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                value="https://jiuxsintslqryrvgevmc.supabase.co/functions/v1/form-webhook"
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard('https://jiuxsintslqryrvgevmc.supabase.co/functions/v1/form-webhook')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Add this URL to your Ninja Forms webhook action.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-1">Required form fields:</p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-700 dark:text-blue-300 text-xs">
                  <li><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">first_name</code> - Contact&apos;s first name</li>
                  <li><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">last_name</code> - Contact&apos;s last name</li>
                  <li><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">email</code> - Contact&apos;s email address</li>
                  <li><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">pipeline_id</code> - Target pipeline ID (hidden field)</li>
                </ul>
                <p className="mt-2 text-xs">Optional: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">phone</code>, <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">country</code>, <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">graduation_year</code></p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Form-to-Pipeline Mapping
              </Label>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Form
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form Name</TableHead>
                  <TableHead>Target Pipeline</TableHead>
                  <TableHead>Submissions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>UCLan Enquiry Form</TableCell>
                  <TableCell>UCLan 2026</TableCell>
                  <TableCell className="text-muted-foreground">1,247</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Gap Year Interest Form</TableCell>
                  <TableCell>UK Gap Year 2026</TableCell>
                  <TableCell className="text-muted-foreground">892</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Summer Residency Form</TableCell>
                  <TableCell>Summer Residency 2026</TableCell>
                  <TableCell className="text-muted-foreground">456</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
