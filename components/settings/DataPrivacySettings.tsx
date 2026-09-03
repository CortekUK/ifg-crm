'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Download, Trash2, Shield, AlertTriangle, Loader2, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/hooks/use-toast'

interface AccountSummary {
  email: string
  full_name: string
  role: string
  impact: {
    open_deals: number
    total_deals: number
    owned_contacts: number
  }
  can_delete: boolean
  blocker: string | null
}

export function DataPrivacySettings() {
  const router = useRouter()
  const [isExporting, setIsExporting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { data: account, isLoading } = useQuery<AccountSummary>({
    queryKey: ['account-summary'],
    queryFn: async () => {
      const res = await fetch('/api/account')
      if (!res.ok) throw new Error('Could not load your account details')
      return res.json()
    },
  })

  const handleExportData = async () => {
    setIsExporting(true)
    try {
      const res = await fetch('/api/account/export')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Export failed (HTTP ${res.status})`)
      }

      const blob = await res.blob()
      const filename =
        res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ??
        'ifg-crm-export.zip'

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: 'Export ready',
        description: `Downloaded ${filename} (${(blob.size / 1_048_576).toFixed(1)} MB).`,
      })
    } catch (err) {
      toast({
        title: 'Export failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) throw new Error(data.error || `Deletion failed (HTTP ${res.status})`)

      // The auth user is gone, so the local session is now a token for an
      // account that no longer exists. Clear it before leaving.
      await createClient().auth.signOut()
      router.replace('/login')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Please try again.')
      setIsDeleting(false)
    }
  }

  const emailMatches =
    confirmEmail.trim().toLowerCase() === (account?.email ?? '').toLowerCase() &&
    confirmEmail.trim().length > 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Data & Privacy</h2>
        <p className="text-sm text-muted-foreground">
          Export the CRM&apos;s data, or close your account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5" />
            Where your data lives
          </CardTitle>
          <CardDescription>How the CRM stores and handles records.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Player and staff records are held in a managed Postgres database, encrypted at rest
            and in transit. Access is restricted per user by row-level security, so people only
            see the records their role allows. Data is kept until it is deleted here or by an
            admin — there is no automatic expiry.
          </p>
          <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-muted-foreground dark:border-slate-700 dark:bg-slate-800/60">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              For a formal GDPR statement — hosting region, retention periods and lawful basis —
              use your organisation&apos;s privacy policy. Those are commitments IFG makes, not
              settings the CRM enforces, so they are not listed here as though they were.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export all data</CardTitle>
          <CardDescription>
            Download the whole CRM as a ZIP of spreadsheets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            One CSV per area — contacts, deals, stage movements, invoices, payments, campaigns,
            email delivery, replies, brochure downloads, form submissions, automations, and lists
            and tags — plus a README listing the row count of each file. Nothing is truncated:
            all 100,000+ contacts are included.
          </p>
          <Button variant="outline" onClick={handleExportData} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isExporting ? 'Preparing export…' : 'Export all data'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Generated on demand and downloaded straight to this device — nothing is emailed or
            stored anywhere else. A full export usually takes under half a minute.
          </p>
        </CardContent>
      </Card>

      <Card className="border-red-200 dark:border-red-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            Danger zone
          </CardTitle>
          <CardDescription>This cannot be undone.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Delete your account</AlertTitle>
            <AlertDescription>
              Your login is removed permanently and you are signed out immediately. CRM records
              you created — players, deals, notes, emails — are kept, but stop being assigned to
              you.
            </AlertDescription>
          </Alert>

          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : account ? (
            <div className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-700">
              <p className="font-medium text-slate-900 dark:text-white">{account.email}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {account.impact.total_deals} {account.impact.total_deals === 1 ? 'deal' : 'deals'}{' '}
                ({account.impact.open_deals} still open) and{' '}
                {account.impact.owned_contacts.toLocaleString()} contacts are assigned to you.
              </p>
              {account.blocker && (
                <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  {account.blocker}
                </p>
              )}
            </div>
          ) : null}

          <Button
            variant="destructive"
            onClick={() => {
              setConfirmEmail('')
              setDeleteError(null)
              setDialogOpen(true)
            }}
            disabled={isLoading || !account?.can_delete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete account
          </Button>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => !isDeleting && setDialogOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete your account
            </DialogTitle>
            <DialogDescription>
              This permanently removes your login. You will be signed out and cannot sign back in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="confirmEmail">
                Type <span className="font-mono font-semibold">{account?.email}</span> to confirm
              </Label>
              <Input
                id="confirmEmail"
                value={confirmEmail}
                onChange={(e) => {
                  setConfirmEmail(e.target.value)
                  setDeleteError(null)
                }}
                placeholder={account?.email}
                autoComplete="off"
                disabled={isDeleting}
              />
            </div>

            {deleteError && (
              <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                {deleteError}
              </p>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDialogOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDeleteAccount}
                disabled={!emailMatches || isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  'Delete permanently'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
