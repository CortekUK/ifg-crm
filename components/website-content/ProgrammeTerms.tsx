'use client'

// Terms & Conditions for each programme.
//
// These are not ordinary page copy: the text here is linked from the Stripe
// payment page, where the customer must tick a box agreeing to it before they
// can pay. Two things follow from that, and the UI says both out loud:
//
//   * Publishing is what puts the terms in front of paying customers. Until a
//     programme is published, its payments fall back to the default terms set
//     in Stripe.
//   * Editing the wording bumps the version, and the version is stamped onto
//     every payment taken afterwards. Old payments keep the version they
//     agreed to, which is the only way to answer "what did they actually
//     agree to?" months later.

import * as React from 'react'
import { Loader2, Save, ExternalLink, ShieldCheck, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'
import { StatusPill } from './_shared'
import { useWebsiteTerms, useSaveTerms, type WebsiteTerms } from '@/lib/hooks/useWebsiteTerms'
import { TERMS_PROGRAMMES, termsUrl } from '@/lib/website-content/terms'

function TermsEditor({ row }: { row: WebsiteTerms }) {
  const meta = TERMS_PROGRAMMES.find((p) => p.key === row.programme)
  const save = useSaveTerms()

  const [title, setTitle] = React.useState(row.title)
  const [body, setBody] = React.useState(row.body)
  const [published, setPublished] = React.useState(row.published)

  const bodyChanged = body.trim() !== row.body.trim()
  const dirty = bodyChanged || title !== row.title || published !== row.published
  const isEmpty = !body.trim()

  const handleSave = async () => {
    if (published && isEmpty) {
      toast({
        title: 'Nothing to publish',
        description: 'Add the terms text before making them live.',
        variant: 'destructive',
      })
      return
    }
    try {
      const { bumped } = await save.mutateAsync({
        programme: row.programme,
        title,
        body,
        published,
        previousBody: row.body,
        previousVersion: row.version,
      })
      toast({
        title: 'Terms saved',
        description: bumped
          ? `Wording changed — now version ${row.version + 1}. Payments from now on record this version.`
          : 'Saved. The wording is unchanged, so the version stays the same.',
      })
    } catch (err) {
      toast({
        title: 'Could not save',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-oswald text-lg font-semibold uppercase text-foreground">
              {meta?.label ?? row.programme}
            </h3>
            <StatusPill published={row.published} />
            <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              v{row.version}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {row.published ? (
              <>Linked from the payment page for this programme.</>
            ) : (
              <>Not live — payments currently fall back to the default terms set in Stripe.</>
            )}
          </p>
        </div>
        {row.published && (
          <a
            href={termsUrl(row.programme)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-muted dark:text-blue-400"
          >
            View live <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={`title-${row.programme}`}>Heading</Label>
          <Input
            id={`title-${row.programme}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`body-${row.programme}`}>Terms &amp; Conditions</Label>
          <Textarea
            id={`body-${row.programme}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            placeholder="Paste the terms for this programme here. A blank line starts a new paragraph."
            className="font-mono text-xs leading-relaxed"
          />
          <p className="text-xs text-muted-foreground">
            Plain text. Leave a blank line between paragraphs; a line starting with
            &ldquo;#&rdquo; becomes a heading.
          </p>
        </div>

        {bodyChanged && !isEmpty && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              You&apos;ve changed the wording, so saving moves this to{' '}
              <strong>version {row.version + 1}</strong>. Payments already taken keep
              version {row.version} on record — they agreed to the old text, and that
              stays true.
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="flex items-center gap-3">
            <Switch
              id={`pub-${row.programme}`}
              checked={published}
              onCheckedChange={setPublished}
              disabled={isEmpty && !published}
            />
            <Label htmlFor={`pub-${row.programme}`} className="cursor-pointer text-sm">
              Live on the website and payment page
            </Label>
          </div>
          <Button onClick={handleSave} disabled={!dirty || save.isPending}>
            {save.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ProgrammeTermsManager() {
  const { data: rows, isLoading } = useWebsiteTerms()

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-64 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  const live = (rows ?? []).filter((r) => r.published && r.body.trim()).length

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'flex items-start gap-2.5 rounded-xl border p-4 text-sm',
          live === (rows ?? []).length
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
            : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
        )}
      >
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Customers must tick a box agreeing to these terms before they can pay —
          on the website and on invoice payment links. {live} of {(rows ?? []).length}{' '}
          programmes have terms published.
          {live < (rows ?? []).length &&
            ' The rest fall back to the default terms set in Stripe until they are published here.'}
        </p>
      </div>

      {(rows ?? []).map((row) => (
        <TermsEditor key={row.programme} row={row} />
      ))}
    </div>
  )
}
