'use client'

// Read-only preview of a saved template, opened from the templates
// list. Mirrors the editor's PreviewModal layout (slim header,
// landscape modal, inbox-style email card) so users get a consistent
// "this is what the recipient will see" feel everywhere.

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Monitor, Smartphone, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { previewMergeTags } from '@/lib/utils/mergeTags'
import { replaceMergeTags } from '@/lib/utils/merge-tags-core'
import { applyBrandingSlots } from '@/lib/templates/render-branding'
import { useEmailBrandingConfig } from '@/lib/hooks/useEmailBranding'
import type { Template } from '@/lib/types/templates'

interface TemplatePreviewModalProps {
  template: Template | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const sampleContacts = [
  { id: '1', first_name: 'John', last_name: 'Smith', email: 'john.smith@example.com' },
  { id: '2', first_name: 'Sarah', last_name: 'Johnson', email: 'sarah.j@example.com' },
  { id: '3', first_name: 'Michael', last_name: 'Brown', email: 'mbrown@example.com' },
]

export function TemplatePreviewModal({
  template,
  open,
  onOpenChange,
}: TemplatePreviewModalProps) {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [selectedContactId, setSelectedContactId] = useState(sampleContacts[0].id)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { data: branding } = useEmailBrandingConfig()

  const selectedContact =
    sampleContacts.find((c) => c.id === selectedContactId) || sampleContacts[0]

  // Generate preview HTML with sample data + the chosen contact's
  // first/last/email substituted in, the same two-pass replacement we
  // use in the editor's side preview.
  const rawHtml = template?.body_html ?? ''
  // Substitute the global header/footer/legal markers before seeding merge
  // tags — otherwise the preview shows a template stripped of its branding,
  // which is not what the recipient receives.
  const branded = branding?.rendered ? applyBrandingSlots(rawHtml, branding.rendered) : rawHtml
  const seeded = previewMergeTags(branded)
  const previewHtml = replaceMergeTags(seeded, {
    first_name: selectedContact.first_name,
    last_name: selectedContact.last_name,
    email: selectedContact.email,
  })

  const previewSubject = template?.subject
    ? replaceMergeTags(previewMergeTags(template.subject), {
        first_name: selectedContact.first_name,
        last_name: selectedContact.last_name,
      })
    : 'No subject'

  useEffect(() => {
    const updateIframe = () => {
      if (iframeRef.current && open) {
        const doc = iframeRef.current.contentDocument
        if (doc) {
          doc.open()
          doc.write(previewHtml)
          doc.close()
        }
      }
    }
    const timer = setTimeout(updateIframe, 50)
    return () => clearTimeout(timer)
  }, [previewHtml, open])

  if (!template) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Same landscape footprint as the editor's preview modal so
        // the email card breathes — was max-w-4xl which left it
        // squashed alongside the title + viewport + select chrome.
        className="flex h-[88vh] w-[95vw] max-w-[1500px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1500px]"
        showCloseButton={false}
      >
        {/* Slim header — title on the left, viewport / test-as / close
            on the right. Single row, no wrap. */}
        <DialogHeader className="shrink-0 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="truncate text-base font-semibold text-slate-900 dark:text-white">
              {template.name}
            </DialogTitle>

            <div className="flex items-center gap-2">
              {/* Viewport */}
              <div className="flex gap-1 rounded-md bg-slate-100 p-0.5 dark:bg-slate-800">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-7 gap-1.5 px-2.5',
                    viewMode === 'desktop'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                      : 'text-slate-500 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-700/60',
                  )}
                  onClick={() => setViewMode('desktop')}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  <span className="text-xs">Desktop</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-7 gap-1.5 px-2.5',
                    viewMode === 'mobile'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                      : 'text-slate-500 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-700/60',
                  )}
                  onClick={() => setViewMode('mobile')}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  <span className="text-xs">Mobile</span>
                </Button>
              </div>

              {/* Test contact */}
              <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                <SelectTrigger className="h-7 w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sampleContacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.first_name} {contact.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-7 w-7 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content — clean grey background, centred email card. The
            iframe stretches to fill the remaining vertical space (was
            pinned to a fixed calc height which left awkward bottom
            gaps in the old layout). */}
        <div className="flex flex-1 min-h-0 justify-center overflow-auto bg-slate-100 px-6 py-6 dark:bg-slate-900">
          <div
            className={cn(
              'flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-slate-200 transition-all dark:ring-slate-700',
              viewMode === 'desktop' ? 'w-full max-w-[1100px]' : 'w-[375px]',
            )}
          >
            {/* Inbox-style header */}
            <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
              <div className="space-y-1 text-[12px]">
                <div className="flex gap-2">
                  <span className="w-12 shrink-0 text-slate-400">From</span>
                  <span className="text-slate-700 dark:text-slate-200">
                    {template.from_name_type === 'deal_owner'
                      ? 'Deal Owner (dynamic)'
                      : template.fixed_from_name || 'IFG Team'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="w-12 shrink-0 text-slate-400">To</span>
                  <span className="text-slate-700 dark:text-slate-200">
                    {selectedContact.email}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="w-12 shrink-0 text-slate-400">Subject</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {previewSubject}
                  </span>
                </div>
              </div>
            </div>

            {/* Rendered email — fills the remaining vertical space. */}
            <iframe
              ref={iframeRef}
              title="Email Preview"
              className="block w-full flex-1 border-0"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
