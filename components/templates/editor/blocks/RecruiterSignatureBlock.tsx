'use client'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserCircle, Mail, Phone, Calendar, AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
// Photo support intentionally removed from the recruiter_signature
// block — IFG signatures use the Macclesfield crest (rendered as part
// of the default footer) instead of a personal headshot, so the
// per-deal-owner photo placeholder ("DO" avatar) is no longer surfaced
// in the editor or the rendered email.
import { cn } from '@/lib/utils'
import { RecruiterSignatureBlockContent } from '@/lib/templates/editor-types'
import { Button } from '@/components/ui/button'

interface RecruiterSignatureBlockProps {
  content: Record<string, unknown>
  isSelected: boolean
  onUpdate: (updates: Record<string, unknown>) => void
}

export function RecruiterSignatureBlock({ content, isSelected, onUpdate }: RecruiterSignatureBlockProps) {
  const signatureContent = content as unknown as RecruiterSignatureBlockContent

  return (
    <div
      style={{
        paddingTop: `${signatureContent.paddingTop || 20}px`,
        paddingBottom: `${signatureContent.paddingBottom || 10}px`,
      }}
    >
      {/* Settings panel when selected */}
      {isSelected && (
        <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <UserCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Recruiter Signature Settings
            </span>
          </div>

          <p className="text-xs text-amber-600 dark:text-amber-400">
            This block automatically shows the deal owner's information at send time.
          </p>

          {/* Toggle options — Photo toggle intentionally removed; the
              IFG signature uses the club crest in the default footer
              rather than a deal-owner headshot. */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-600 dark:text-slate-400">Name</Label>
              <Switch
                checked={signatureContent.showName !== false}
                onCheckedChange={(checked) => onUpdate({ showName: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-600 dark:text-slate-400">Title</Label>
              <Switch
                checked={signatureContent.showTitle !== false}
                onCheckedChange={(checked) => onUpdate({ showTitle: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-600 dark:text-slate-400">Email</Label>
              <Switch
                checked={signatureContent.showEmail !== false}
                onCheckedChange={(checked) => onUpdate({ showEmail: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-600 dark:text-slate-400">Phone</Label>
              <Switch
                checked={signatureContent.showPhone !== false}
                onCheckedChange={(checked) => onUpdate({ showPhone: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-600 dark:text-slate-400">Calendly</Label>
              <Switch
                checked={signatureContent.showCalendly !== false}
                onCheckedChange={(checked) => onUpdate({ showCalendly: checked })}
              />
            </div>
          </div>

          {/* Layout and alignment */}
          <div className="flex items-center gap-4 pt-2 border-t border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-600 dark:text-slate-400">Layout:</Label>
              <Select
                value={signatureContent.layout || 'inline'}
                onValueChange={(v) => onUpdate({ layout: v })}
              >
                <SelectTrigger className="h-7 w-24 text-xs bg-white dark:bg-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inline">Inline</SelectItem>
                  <SelectItem value="stacked">Stacked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-slate-600 dark:text-slate-400">Text colour:</Label>
              <input
                type="color"
                value={signatureContent.textColor || '#374151'}
                onChange={(e) => onUpdate({ textColor: e.target.value })}
                className="h-6 w-8 cursor-pointer rounded border border-amber-200 bg-white p-0 dark:border-amber-800"
                title="Signature text colour"
              />
              {signatureContent.textColor && (
                <button
                  type="button"
                  onClick={() => onUpdate({ textColor: null })}
                  className="text-[10px] text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  title="Reset to default colours"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Label className="text-xs text-slate-600 dark:text-slate-400 mr-1">Align:</Label>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-7 w-7', signatureContent.alignment === 'left' && 'bg-amber-200 dark:bg-amber-800')}
                onClick={() => onUpdate({ alignment: 'left' })}
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-7 w-7', signatureContent.alignment === 'center' && 'bg-amber-200 dark:bg-amber-800')}
                onClick={() => onUpdate({ alignment: 'center' })}
              >
                <AlignCenter className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-7 w-7', signatureContent.alignment === 'right' && 'bg-amber-200 dark:bg-amber-800')}
                onClick={() => onUpdate({ alignment: 'right' })}
              >
                <AlignRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Preview — wrapping div carries text-align. Each
          text element below applies textColor as an inline style so
          the override wins over the default Tailwind text-slate-*
          utilities (inherited `color` would lose to the children's
          own colour classes). */}
      <div
        className={cn(
          'rounded-lg p-4',
          isSelected
            ? 'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700'
            : ''
        )}
        style={{ textAlign: signatureContent.alignment || 'left' }}
      >
        <div
          className={cn(
            'flex flex-col gap-2',
            signatureContent.alignment === 'center' && 'items-center',
            signatureContent.alignment === 'right' && 'items-end',
          )}
        >
          {/* Details. The `colorStyle` is computed once from the
              optional textColor override and applied inline on every
              text element so it beats the default Tailwind
              `text-slate-*` classes (which would otherwise win over an
              inherited colour). */}
          <div>
            {(() => {
              const c = signatureContent.textColor || undefined
              const colorStyle: React.CSSProperties | undefined = c ? { color: c } : undefined
              return (
                <>
                  {signatureContent.showName !== false && (
                    <p className="font-semibold text-slate-900 dark:text-white" style={colorStyle}>
                      {'{{deal_owner_name}}'}
                    </p>
                  )}
                  {signatureContent.showTitle !== false && (
                    <p className="text-sm text-slate-600 dark:text-slate-400" style={colorStyle}>
                      {'{{deal_owner_title}}'}
                    </p>
                  )}
                  <div className="mt-2 space-y-1">
                    {signatureContent.showEmail !== false && (
                      <p className="text-sm text-slate-600 dark:text-slate-400" style={colorStyle}>
                        <Mail className="mr-1.5 inline-block h-3.5 w-3.5 align-middle text-slate-400" style={colorStyle} />
                        <span className="align-middle">{'{{deal_owner_email}}'}</span>
                      </p>
                    )}
                    {signatureContent.showPhone !== false && (
                      <p className="text-sm text-slate-600 dark:text-slate-400" style={colorStyle}>
                        <Phone className="mr-1.5 inline-block h-3.5 w-3.5 align-middle text-slate-400" style={colorStyle} />
                        <span className="align-middle">{'{{deal_owner_phone}}'}</span>
                      </p>
                    )}
                    {signatureContent.showCalendly !== false && (
                      <p className="text-sm text-blue-600 dark:text-blue-400" style={colorStyle}>
                        <Calendar className="mr-1.5 inline-block h-3.5 w-3.5 align-middle" style={colorStyle} />
                        <span className="align-middle underline">Book a call with me</span>
                      </p>
                    )}
                  </div>
                </>
              )
            })()}
          </div>
        </div>

        {/* Default IFG signature footer — logo + company / confidentiality
            text. Always present (no toggle); the variable parts above are
            what flex per template. Mirror of SIGNATURE_COMPANY_BLOCK in
            lib/templates/render-html.ts so what the user sees here is
            what gets sent.

            The logo uses display:inline-block so the parent's
            text-align (driven by signatureContent.alignment) actually
            positions it left/centre/right, the same way the variable
            details flow. */}
        <div className="mt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/signature-logo.png"
            alt="Macclesfield FC"
            style={{ width: 110, height: 'auto', display: 'inline-block' }}
          />
          <p
            className="mt-3 text-[12px] leading-relaxed text-slate-600 dark:text-slate-400"
            style={
              signatureContent.companyTextColor
                ? { color: signatureContent.companyTextColor }
                : undefined
            }
          >
            Macc Football Club Limited, a company registered in England. Company
            number 12931817. Registered office address: The Leasing.com Stadium,
            London Rd, Macclesfield, SK11 7SP.
          </p>
          <p
            className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-500"
            style={
              signatureContent.confidentialityColor
                ? { color: signatureContent.confidentialityColor }
                : undefined
            }
          >
            <strong>Confidentiality:</strong> Privileged / Confidential
            information may be contained in this message and may be subject to
            legal privilege. Access to this email by anyone other than the
            intended is unauthorised. If you are not the intended recipient
            (or responsible for delivery of the message to such person), you
            may not use, copy, distribute or deliver to anyone this message
            (or any part of its contents) or take any action in reliance on
            it. In such case, you should destroy this message, and notify us
            immediately. If you have received this email in error, please
            notify us immediately by email or telephone and delete the email
            from any company. All reasonable precautions have been taken to
            ensure no viruses are present in this email. As our company
            cannot accept responsibility for any loss or damage arising from
            the use of this email or attachments we recommend that you
            subject these to your virus checking procedures prior to use.
          </p>
        </div>
      </div>
    </div>
  )
}
