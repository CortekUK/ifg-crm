'use client'

// Global email branding — the single place the header strip, sender
// signature, social row, partner logos + disclaimer, and unsubscribe strip
// are edited. Every template and every future template renders whatever is
// saved here.
//
// The section editors are the SAME components the template editor uses,
// driven with isSelected={true} so their settings panels stay open. That
// keeps one implementation of each editor rather than a settings-only copy
// that would drift from the canvas.

import { useState, useEffect, useMemo } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Save,
  Loader2,
  AlertTriangle,
  Upload,
  Info,
  Monitor,
} from 'lucide-react'
import { toast } from '@/lib/hooks/use-toast'
import { useEmailBranding } from '@/lib/hooks/useEmailBranding'
import { uploadEmailImage } from '@/lib/templates/upload-image'
import {
  DEFAULT_EMAIL_BRANDING,
  type EmailBranding,
} from '@/lib/templates/branding-types'
import { renderTemplateWithBranding } from '@/lib/templates/render-branding'
import { SocialBlock } from '@/components/templates/editor/blocks/SocialBlock'
import { CompanySignatureBlock } from '@/components/templates/editor/blocks/CompanySignatureBlock'
import { RecruiterSignatureBlock } from '@/components/templates/editor/blocks/RecruiterSignatureBlock'
import type { EditorBlock } from '@/lib/templates/editor-types'

// Stand-in message body for the live preview, so the branding is shown in
// the context it actually renders in rather than floating on its own.
const PREVIEW_BODY: EditorBlock[] = [
  {
    id: 'preview-text',
    type: 'text',
    content: {
      html: '<p>Hi Alex,</p><p>This is a sample message body. Everything above and below it is the global branding you are editing — it appears on every template.</p>',
      alignment: 'left',
      fontSize: 'normal',
      paddingTop: 10,
      paddingBottom: 10,
    },
  },
]

/** Header/legal colour swatch + hex field. */
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border bg-white p-0.5 dark:border-slate-700"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 flex-1 font-mono text-xs"
        />
      </div>
    </div>
  )
}

/** Card header with an enable/disable switch for the whole section. */
function SectionToggle({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  label: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export function EmailBrandingSettings() {
  const { data, isLoading, save, isSaving } = useEmailBranding()
  const [branding, setBranding] = useState<EmailBranding>(DEFAULT_EMAIL_BRANDING)
  const [dirty, setDirty] = useState(false)
  const [uploadingHeaderLogo, setUploadingHeaderLogo] = useState(false)

  useEffect(() => {
    if (data?.config) {
      setBranding(data.config)
      setDirty(false)
    }
  }, [data?.config])

  // Typed partial updates for the top-level sections.
  const patch = <K extends keyof EmailBranding>(
    key: K,
    value: EmailBranding[K],
  ) => {
    setBranding((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const patchHeader = (updates: Partial<EmailBranding['header']>) =>
    patch('header', { ...branding.header, ...updates })
  const patchLegal = (updates: Partial<EmailBranding['legal']>) =>
    patch('legal', { ...branding.legal, ...updates })

  // The editor block components hand back loose Record<string, unknown>
  // patches; merge them into the typed section they belong to.
  const patchBlockSection = <K extends 'signature' | 'social' | 'company'>(
    key: K,
  ) => (updates: Record<string, unknown>) =>
    patch(key, { ...branding[key], ...updates } as EmailBranding[K])

  const previewHtml = useMemo(
    () => renderTemplateWithBranding(PREVIEW_BODY, null, branding),
    [branding],
  )

  const handleHeaderLogoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingHeaderLogo(true)
    try {
      const url = await uploadEmailImage(file)
      patchHeader({ logoUrl: url, mode: 'image' })
      toast({ title: 'Logo uploaded', description: 'Header logo updated.' })
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setUploadingHeaderLogo(false)
    }
  }

  const handleSave = async () => {
    try {
      await save(branding)
      setDirty(false)
      toast({
        title: 'Branding published',
        description: 'Every template now uses this header and footer.',
      })
    } catch (err) {
      toast({
        title: 'Failed to save',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Email Branding
          </h2>
          <p className="text-sm text-muted-foreground">
            One header and footer shared by every email template — existing and
            future. Changes apply everywhere as soon as you publish.
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving || !dirty}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {dirty ? 'Publish changes' : 'Published'}
        </Button>
      </div>

      {data?.stale && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-900/20">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Saved branding is out of date
            </p>
            <p className="text-amber-800 dark:text-amber-300">
              The email renderer has changed since this was last published.
              Press <strong>Publish changes</strong> to refresh what gets sent.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* ------------------------------ Editors ----------------------- */}
        <div className="space-y-6">
          {/* Header strip */}
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Header</CardTitle>
                <CardDescription>
                  The band at the very top of every email.
                </CardDescription>
              </div>
              <SectionToggle
                checked={branding.showHeader}
                onCheckedChange={(v) => patch('showHeader', v)}
                label="Show"
              />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={branding.header.mode === 'text' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => patchHeader({ mode: 'text' })}
                >
                  Wordmark
                </Button>
                <Button
                  variant={branding.header.mode === 'image' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => patchHeader({ mode: 'image' })}
                >
                  Logo image
                </Button>
              </div>

              {branding.header.mode === 'text' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Wordmark</Label>
                    <Input
                      value={branding.header.text}
                      onChange={(e) => patchHeader({ text: e.target.value })}
                      placeholder="IFG"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Strapline</Label>
                    <Input
                      value={branding.header.subtext}
                      onChange={(e) => patchHeader({ subtext: e.target.value })}
                      placeholder="International Football Group"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-2">
                      <Label className="text-xs">Logo URL</Label>
                      <Input
                        value={branding.header.logoUrl}
                        onChange={(e) => patchHeader({ logoUrl: e.target.value })}
                        placeholder="https://… or upload →"
                      />
                    </div>
                    <label>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        className="hidden"
                        disabled={uploadingHeaderLogo}
                        onChange={handleHeaderLogoUpload}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={uploadingHeaderLogo}
                        onClick={(e) => {
                          e.preventDefault()
                          const input = e.currentTarget
                            .previousElementSibling as HTMLInputElement
                          input?.click()
                        }}
                      >
                        {uploadingHeaderLogo ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </Button>
                    </label>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Logo width (px)</Label>
                    <Input
                      type="number"
                      min={40}
                      max={560}
                      value={branding.header.logoWidth}
                      onChange={(e) =>
                        patchHeader({
                          logoWidth: parseInt(e.target.value, 10) || 160,
                        })
                      }
                      className="w-32"
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <ColorField
                  label="Background"
                  value={branding.header.bgColor}
                  onChange={(v) => patchHeader({ bgColor: v })}
                />
                <ColorField
                  label="Text"
                  value={branding.header.textColor}
                  onChange={(v) => patchHeader({ textColor: v })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Click-through URL (optional)</Label>
                <Input
                  value={branding.header.linkUrl}
                  onChange={(e) => patchHeader({ linkUrl: e.target.value })}
                  placeholder="https://theinternationalfootballgroup.com"
                />
              </div>
            </CardContent>
          </Card>

          {/* Sender signature */}
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Sender signature</CardTitle>
                <CardDescription>
                  Personalised per deal owner at send time.
                </CardDescription>
              </div>
              <SectionToggle
                checked={branding.showSignature}
                onCheckedChange={(v) => patch('showSignature', v)}
                label="Show"
              />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2 rounded-md bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Name, title, email, phone and Calendly are filled in from each
                  deal&apos;s owner when the email is sent. Deals with no owner
                  fall back to Nathan Bibby.
                </span>
              </div>
              <RecruiterSignatureBlock
                content={branding.signature as unknown as Record<string, unknown>}
                isSelected
                onUpdate={patchBlockSection('signature')}
              />
            </CardContent>
          </Card>

          {/* Social row */}
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Social channels</CardTitle>
                <CardDescription>
                  Toggle a channel off to hide it from every email.
                </CardDescription>
              </div>
              <SectionToggle
                checked={branding.showSocial}
                onCheckedChange={(v) => patch('showSocial', v)}
                label="Show"
              />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={branding.showDivider}
                  onCheckedChange={(v) => patch('showDivider', v)}
                />
                <span className="text-xs text-muted-foreground">
                  Divider line above the social row
                </span>
              </div>
              <SocialBlock
                content={branding.social as unknown as Record<string, unknown>}
                isSelected
                onUpdate={patchBlockSection('social')}
              />
            </CardContent>
          </Card>

          {/* Partner logos + disclaimer */}
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">
                  Partner logos &amp; disclaimer
                </CardTitle>
                <CardDescription>
                  Logo row and the legal confidentiality notice.
                </CardDescription>
              </div>
              <SectionToggle
                checked={branding.showCompany}
                onCheckedChange={(v) => patch('showCompany', v)}
                label="Show"
              />
            </CardHeader>
            <CardContent>
              <CompanySignatureBlock
                content={branding.company as unknown as Record<string, unknown>}
                isSelected
                onUpdate={patchBlockSection('company')}
              />
            </CardContent>
          </Card>

          {/* Unsubscribe / legal strip */}
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Unsubscribe strip</CardTitle>
                <CardDescription>
                  The grey band at the very bottom.
                </CardDescription>
              </div>
              <SectionToggle
                checked={branding.showLegal}
                onCheckedChange={(v) => patch('showLegal', v)}
                label="Show"
              />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Company name</Label>
                <Input
                  value={branding.legal.companyName}
                  onChange={(e) => patchLegal({ companyName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Postal address</Label>
                <Input
                  value={branding.legal.addressLine}
                  onChange={(e) => patchLegal({ addressLine: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  UK PECR and CAN-SPAM both expect a real registered address in
                  marketing email, not just a city.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={branding.legal.showUnsubscribe}
                  onCheckedChange={(v) => patchLegal({ showUnsubscribe: v })}
                />
                <span className="text-xs text-muted-foreground">
                  Show the unsubscribe link
                </span>
              </div>
              {branding.legal.showUnsubscribe && (
                <div className="space-y-2">
                  <Label className="text-xs">Unsubscribe link text</Label>
                  <Input
                    value={branding.legal.unsubscribeLabel}
                    onChange={(e) =>
                      patchLegal({ unsubscribeLabel: e.target.value })
                    }
                  />
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-3">
                <ColorField
                  label="Background"
                  value={branding.legal.bgColor}
                  onChange={(v) => patchLegal({ bgColor: v })}
                />
                <ColorField
                  label="Text"
                  value={branding.legal.textColor}
                  onChange={(v) => patchLegal({ textColor: v })}
                />
                <ColorField
                  label="Link"
                  value={branding.legal.linkColor}
                  onChange={(v) => patchLegal({ linkColor: v })}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ------------------------------ Preview ----------------------- */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Monitor className="h-4 w-4" />
                Live preview
              </CardTitle>
              <CardDescription>
                Merge tags show unresolved here; they fill in per recipient when
                the email is sent.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <iframe
                title="Email branding preview"
                srcDoc={previewHtml}
                sandbox=""
                className="h-[720px] w-full border-0 bg-white"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
