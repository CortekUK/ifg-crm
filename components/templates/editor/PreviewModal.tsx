'use client'

// Fullscreen preview dialog. Opened from the maximise icon inside the
// side-preview drawer, gives the user a roomier view of the rendered
// email with the same merge-tag substitution.
//
// Earlier this dialog was crowded — title + viewport toggle + contact
// select + email input + Send Test + close all fighting on one row, and
// a fake "macOS window" chrome (red/yellow/green dots) inside the email
// frame. We've slimmed it: header is just title + viewport + test
// contact + close. The "send test" composer is gone — the side-preview
// pane already has a single-button "Send to me" affordance, no need to
// duplicate the address-and-validate flow here.

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
import { renderBlocksToHTML, replaceVariables } from '@/lib/templates/render-html'
import { useEmailBrandingConfig } from '@/lib/hooks/useEmailBranding'
import { sampleContacts, TemplateSettings, EditorBlock } from '@/lib/templates/editor-types'

interface PreviewModalProps {
  isOpen: boolean
  onClose: () => void
  blocks: EditorBlock[]
  settings: TemplateSettings
}

export function PreviewModal({ isOpen, onClose, blocks, settings }: PreviewModalProps) {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [selectedContactId, setSelectedContactId] = useState(sampleContacts[0].id)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { data: branding } = useEmailBrandingConfig()

  const selectedContact =
    sampleContacts.find((c) => c.id === selectedContactId) || sampleContacts[0]

  // Generate HTML with sample data
  const rawHtml = renderBlocksToHTML(blocks, settings.theme, branding?.rendered)
  const previewHtml = replaceVariables(rawHtml, {
    first_name: selectedContact.first_name,
    last_name: selectedContact.last_name,
    email: selectedContact.email,
    programme: 'UCLan 2026',
    calendly_link: 'https://calendly.com/ifg-recruiter',
    recruiter_name: 'Sarah Johnson',
    recruiter_email: 'sarah@ifg.com',
    unsubscribe_url: '#',
    subject: settings.subject,
  })

  // Update iframe content when HTML changes or modal opens
  useEffect(() => {
    if (isOpen && iframeRef.current) {
      const doc = iframeRef.current.contentDocument
      if (doc) {
        doc.open()
        doc.write(previewHtml)
        doc.close()
      }
    }
  }, [previewHtml, isOpen, selectedContactId])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        // Wider, landscape-oriented. max-w-5xl was 1024px which felt
        // cramped — bumping to 95vw with a 1500px ceiling makes the
        // surrounding chrome breathe and matches the "preview at scale"
        // intent of the fullscreen modal.
        className="flex h-[88vh] w-[95vw] max-w-[1500px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1500px]"
        showCloseButton={false}
      >
        {/* Slim header — title on the left, viewport + test-as + close
            on the right. Single row, no wrap. */}
        <DialogHeader className="shrink-0 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base font-semibold text-slate-900 dark:text-white">
              Email preview
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
                onClick={onClose}
                className="h-7 w-7 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content — clean grey background, centred email card. The
            inner flex column makes the iframe stretch to fill the
            remaining height instead of being pinned to a hardcoded
            600px (the modal is much taller now). */}
        <div className="flex flex-1 min-h-0 justify-center overflow-auto bg-slate-100 px-6 py-6 dark:bg-slate-900">
          <div
            className={cn(
              'flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-slate-200 transition-all dark:ring-slate-700',
              // Desktop view spans much wider now (up to 1100px) so the
              // landscape modal doesn't leave huge grey gutters around a
              // skinny 640px card. Mobile view stays at 375px to mirror
              // the actual phone viewport.
              viewMode === 'desktop' ? 'w-full max-w-[1100px]' : 'w-[375px]',
            )}
          >
            {/* Inbox-style header */}
            <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
              <div className="space-y-1 text-[12px]">
                <div className="flex gap-2">
                  <span className="w-12 shrink-0 text-slate-400">From</span>
                  <span className="text-slate-700 dark:text-slate-200">
                    {settings.fromNameType === 'deal_owner'
                      ? 'Sarah Johnson'
                      : settings.fixedFromName || 'IFG Team'}
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
                    {replaceVariables(settings.subject || 'Enter your subject line…', {
                      first_name: selectedContact.first_name,
                      last_name: selectedContact.last_name,
                    })}
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
