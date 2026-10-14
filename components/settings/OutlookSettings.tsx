'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { AlertCircle, Check, Loader2, Mail, RefreshCw, Unlink } from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import { useDisconnectOutlook, useOutlookStatus, useSyncOutlook } from '@/lib/hooks/useOutlook'
import { toast } from '@/lib/hooks/use-toast'

/**
 * Connect an Outlook mailbox — the same place, and the same shape, as the
 * Calendly connection, because it is the same job: a recruiter linking their
 * own account once.
 *
 * Unlike Calendly (which takes a pasted token) this is a real OAuth round
 * trip, so "Connect" is a navigation, not a form submit.
 */
export function OutlookSettings() {
  const searchParams = useSearchParams()
  const { data: status, isLoading, refetch } = useOutlookStatus()
  const disconnectOutlook = useDisconnectOutlook()
  const syncOutlook = useSyncOutlook()
  const [isRedirecting, setIsRedirecting] = useState(false)

  // The OAuth callback redirects back here with the outcome in the query
  // string — it is a browser navigation, so there is no response to read.
  useEffect(() => {
    const error = searchParams.get('outlook_error')
    const connected = searchParams.get('outlook_connected')
    if (error) {
      toast({ title: 'Outlook not connected', description: error, variant: 'destructive' })
    } else if (connected) {
      toast({
        title: 'Outlook connected',
        description: connected === '1' ? 'Your mailbox is linked.' : `Connected as ${connected}.`,
      })
      refetch()
    }
    if (error || connected) {
      // Clear the params so a refresh does not replay the toast.
      const url = new URL(window.location.href)
      url.searchParams.delete('outlook_error')
      url.searchParams.delete('outlook_connected')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams, refetch])

  const handleConnect = () => {
    setIsRedirecting(true)
    window.location.href = '/api/auth/microsoft/start'
  }

  const handleDisconnect = async () => {
    try {
      await disconnectOutlook.mutateAsync()
      toast({
        title: 'Outlook disconnected',
        description: 'Mail already synced stays in the CRM. No new mail will arrive.',
      })
    } catch (error) {
      toast({
        title: 'Could not disconnect',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleSync = async () => {
    try {
      const result = await syncOutlook.mutateAsync()
      toast({
        title: 'Sync complete',
        description: `${result.inserted} new message${result.inserted === 1 ? '' : 's'} brought in.`,
      })
    } catch (error) {
      toast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  const notConfigured = status && !status.configured

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
            <Mail className="h-5 w-5 text-blue-600 dark:text-blue-300" />
          </div>
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              Outlook
              {status?.connected && (
                <Badge className="bg-green-600 text-white">
                  <Check className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              )}
              {status?.status === 'reconnect_needed' && (
                <Badge className="bg-amber-500 text-white">Reconnect needed</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Send and receive email from your own mailbox inside the CRM.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {notConfigured && (
          <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900 p-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900 dark:text-amber-200">
              <p className="font-medium">Outlook is not set up on this deployment yet.</p>
              <p className="mt-1">
                An administrator needs to add the Microsoft credentials before mailboxes can be
                connected.
              </p>
            </div>
          </div>
        )}

        {/* A broken connection is a normal state, not an error. Say what
            happened and offer the one button that fixes it. */}
        {status?.status === 'reconnect_needed' && (
          <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900 p-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900 dark:text-amber-200">
              <p className="font-medium">Your Outlook connection has stopped working.</p>
              <p className="mt-1">
                This usually happens after a Microsoft password change. Reconnect to start
                receiving mail again — nothing already in the CRM is lost.
              </p>
              {status.statusDetail && (
                <p className="mt-1 text-xs opacity-80">{status.statusDetail}</p>
              )}
            </div>
          </div>
        )}

        {status?.connected && (
          <div className="rounded-lg border bg-gray-50 dark:bg-slate-900/40 p-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Mailbox</span>
              <span className="font-medium truncate">{status.mailboxEmail}</span>
            </div>
            {status.connectedAt && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Connected</span>
                <span>{formatDate(status.connectedAt)}</span>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Last sync</span>
              <span>{status.lastSyncedAt ? formatDate(status.lastSyncedAt) : 'Not yet'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Live updates</span>
              <span>
                {status.notificationsActive ? (
                  'Active'
                ) : (
                  // Worth surfacing: when the subscription lapses, mail stops
                  // arriving and nothing errors. It just looks like a quiet day.
                  <span className="text-amber-600">Catching up on a schedule</span>
                )}
              </span>
            </div>
            {status.lastSyncError && (
              <p className="text-xs text-amber-600 pt-1">{status.lastSyncError}</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {status?.connected ? (
            <>
              <Button variant="outline" onClick={handleSync} disabled={syncOutlook.isPending}>
                {syncOutlook.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync now
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-red-600 hover:text-red-700">
                    <Unlink className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect Outlook?</AlertDialogTitle>
                    <AlertDialogDescription>
                      New mail will stop arriving in the CRM and you will not be able to send from
                      here. Messages already synced stay where they are, and you can reconnect at
                      any time.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDisconnect}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Disconnect
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <Button onClick={handleConnect} disabled={isRedirecting || notConfigured}>
              {isRedirecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              {status?.status === 'reconnect_needed' ? 'Reconnect Outlook' : 'Connect Outlook'}
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Mail you send from the CRM goes out from your own mailbox and appears in your Outlook
          Sent Items. Campaigns and automated sequences are not affected — those keep sending the
          way they always have.
        </p>
      </CardContent>
    </Card>
  )
}
