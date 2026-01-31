'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Calendar,
  Check,
  Loader2,
  ExternalLink,
  Key,
  Link2,
  Unlink,
  AlertCircle,
  Copy,
} from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import {
  useCalendlyConnectionStatus,
  useConnectCalendly,
  useDisconnectCalendly,
} from '@/lib/hooks/useCalendlyEvents'
import { toast } from '@/lib/hooks/use-toast'

export function CalendlySettings() {
  const [accessToken, setAccessToken] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [showToken, setShowToken] = useState(false)

  const { data: connectionStatus, isLoading: statusLoading } = useCalendlyConnectionStatus()
  const connectCalendly = useConnectCalendly()
  const disconnectCalendly = useDisconnectCalendly()

  const webhookUrl = typeof window !== 'undefined'
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/calendly-webhook`
    : 'https://[your-project].supabase.co/functions/v1/calendly-webhook'

  const handleConnect = async () => {
    if (!accessToken.trim()) {
      toast({
        title: 'Access token required',
        description: 'Please enter your Calendly Personal Access Token.',
        variant: 'destructive',
      })
      return
    }

    try {
      const result = await connectCalendly.mutateAsync({
        accessToken: accessToken.trim(),
        webhookSecret: webhookSecret.trim() || undefined,
      })

      toast({
        title: 'Calendly connected',
        description: `Successfully connected as ${result.user_name || 'Calendly user'}.`,
      })

      setAccessToken('')
      setWebhookSecret('')
    } catch (error) {
      toast({
        title: 'Connection failed',
        description: error instanceof Error ? error.message : 'Failed to connect to Calendly.',
        variant: 'destructive',
      })
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnectCalendly.mutateAsync()
      toast({
        title: 'Calendly disconnected',
        description: 'Your Calendly account has been disconnected.',
      })
    } catch (error) {
      toast({
        title: 'Disconnect failed',
        description: error instanceof Error ? error.message : 'Failed to disconnect Calendly.',
        variant: 'destructive',
      })
    }
  }

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl)
    toast({
      title: 'Copied',
      description: 'Webhook URL copied to clipboard.',
    })
  }

  if (statusLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Calendly Integration</h2>
        <p className="text-sm text-muted-foreground">
          Connect your Calendly account to automatically track scheduled meetings.
        </p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${connectionStatus?.connected ? 'bg-green-100' : 'bg-gray-100'}`}>
                <Calendar className={`h-5 w-5 ${connectionStatus?.connected ? 'text-green-600' : 'text-gray-500'}`} />
              </div>
              <div>
                <CardTitle className="text-base">Calendly</CardTitle>
                <CardDescription>
                  {connectionStatus?.connected
                    ? 'Your Calendly account is connected'
                    : 'Connect your Calendly account'}
                </CardDescription>
              </div>
            </div>
            <Badge variant={connectionStatus?.connected ? 'default' : 'secondary'} className={connectionStatus?.connected ? 'bg-green-100 text-green-700' : ''}>
              {connectionStatus?.connected ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Connected
                </>
              ) : (
                'Not connected'
              )}
            </Badge>
          </div>
        </CardHeader>

        {connectionStatus?.connected ? (
          <CardContent className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-green-900">Connected successfully</p>
                  {connectionStatus.connected_at && (
                    <p className="text-green-700 mt-1">
                      Connected on {formatDate(connectionStatus.connected_at)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                  <Unlink className="h-4 w-4 mr-2" />
                  Disconnect Calendly
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect Calendly?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will disconnect your Calendly account. New meetings will no longer be synced automatically. Existing meeting records will be preserved.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDisconnect}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {disconnectCalendly.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Disconnect'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        ) : (
          <CardContent className="space-y-6">
            {/* Setup Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Setup Instructions</h4>
              <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                <li>
                  Go to{' '}
                  <a
                    href="https://calendly.com/integrations/api_webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-blue-600"
                  >
                    Calendly API & Webhooks
                    <ExternalLink className="h-3 w-3 inline ml-1" />
                  </a>
                </li>
                <li>Generate a Personal Access Token and paste it below</li>
                <li>Create a Webhook Subscription with the URL below</li>
                <li>Select events: <code className="bg-blue-100 px-1 rounded">invitee.created</code> and <code className="bg-blue-100 px-1 rounded">invitee.canceled</code></li>
                <li>Copy the Webhook Signing Key (optional but recommended)</li>
              </ol>
            </div>

            {/* Webhook URL */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Webhook URL
              </Label>
              <div className="flex gap-2">
                <Input
                  value={webhookUrl}
                  readOnly
                  className="font-mono text-sm bg-gray-50"
                />
                <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use this URL when creating your Calendly webhook subscription
              </p>
            </div>

            {/* Access Token */}
            <div className="space-y-2">
              <Label htmlFor="access-token" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Personal Access Token
              </Label>
              <div className="relative">
                <Input
                  id="access-token"
                  type={showToken ? 'text' : 'password'}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Enter your Calendly Personal Access Token"
                  className="pr-20"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-gray-700"
                >
                  {showToken ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Webhook Signing Key (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="webhook-secret" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Webhook Signing Key
                <Badge variant="outline" className="text-xs">Optional</Badge>
              </Label>
              <Input
                id="webhook-secret"
                type="password"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="Enter your webhook signing key for security"
              />
              <p className="text-xs text-muted-foreground">
                Recommended for verifying webhook requests are from Calendly
              </p>
            </div>

            {/* Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">
                Your access token is stored securely. Never share your token with anyone.
              </p>
            </div>

            {/* Connect Button */}
            <Button
              onClick={handleConnect}
              disabled={!accessToken.trim() || connectCalendly.isPending}
              className="w-full"
            >
              {connectCalendly.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-2" />
                  Connect Calendly
                </>
              )}
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
