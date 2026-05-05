'use client'

// Reusable card showing the webhook URL the user pastes into their form
// integration (ActiveCampaign or a WordPress plugin). Lives in two places:
//   1. ConfigureAutomationModal — under the Form ID input, so the user can
//      copy the URL the moment they pick a slug.
//   2. AutomationDetailSheet — on the Overview tab of any deal_creation /
//      list_assignment automation, so the URL is always re-findable
//      without entering edit mode (matters when an automation is deleted
//      and recreated — the URL is the only thing that needs to match AC).

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Check, Copy } from 'lucide-react'
import { toast } from '@/lib/hooks/use-toast'

type FormSource =
  | 'activecampaign'
  | 'gravity_forms'
  | 'wpforms'
  | 'contact_form_7'
  | 'elementor_forms'
  | 'generic'
  | null
  | undefined

export function FormWebhookUrlBlock({
  formId,
  formSource,
}: {
  formId: string | undefined | null
  formSource: FormSource
}) {
  const [copied, setCopied] = useState(false)

  const token = (formId ?? '').trim()
  const baseUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'https://ifg-crm.vercel.app'

  // The two webhook endpoints expect different payload shapes:
  //   /api/webhooks/wordpress     — Gravity Forms, WPForms, Contact Form 7,
  //                                 Elementor.
  //   /api/webhooks/activecampaign — AC's contact[…] form-encoded payload.
  // Default toward AC since it's the dominant integration; legacy
  // automations with form_source = null/'generic' behaved that way too.
  const wordpressPlugins = ['gravity_forms', 'wpforms', 'contact_form_7', 'elementor_forms']
  const isWordpress = !!formSource && wordpressPlugins.includes(formSource)
  const endpoint = isWordpress ? '/api/webhooks/wordpress' : '/api/webhooks/activecampaign'

  const webhookUrl = token ? `${baseUrl}${endpoint}?form_id=${encodeURIComponent(token)}` : ''
  const integrationLabel = isWordpress ? 'WordPress' : 'ActiveCampaign'

  const handleCopy = async () => {
    if (!webhookUrl) return
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Select the URL and copy manually.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30 p-3 space-y-2">
      <Label className="text-xs font-semibold text-blue-900 dark:text-blue-200 uppercase tracking-wide">
        Webhook URL to give to {integrationLabel}
      </Label>
      {token ? (
        <>
          <div className="flex items-stretch gap-2">
            <Input
              readOnly
              value={webhookUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleCopy}
              className="shrink-0"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </>
              )}
            </Button>
          </div>
          <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80">
            {formSource === 'activecampaign'
              ? 'Paste into ActiveCampaign → Automation → Webhook action. The form_id token must stay exactly as shown.'
              : isWordpress
                ? 'Paste into your WordPress form plugin’s webhook setting. The form_id token must stay exactly as shown.'
                : 'Paste into the form integration. The form_id token must stay exactly as shown.'}
          </p>
        </>
      ) : (
        <p className="text-xs text-blue-800/80 dark:text-blue-300/80 italic">
          No Form ID set on this automation — submissions can&apos;t be routed yet.
        </p>
      )}
    </div>
  )
}
