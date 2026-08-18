'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Monitor, Smartphone, Send, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { renderBlocksToHTML } from '@/lib/templates/render-html'
import { useEmailBrandingConfig } from '@/lib/hooks/useEmailBranding'
import { sampleContacts, TemplateSettings, EditorBlock } from '@/lib/templates/editor-types'
import { previewMergeTags } from '@/lib/utils/mergeTags'
import { toast } from '@/lib/hooks/use-toast'

interface EditorPreviewProps {
  blocks: EditorBlock[]
  settings: TemplateSettings
  // Optional: when wired, renders an X button in the header to close
  // the drawer (the right-edge tab also toggles, but having an explicit
  // close inside the drawer is easier to spot when it's open).
  onClose?: () => void
}

export function EditorPreview({ blocks, settings, onClose }: EditorPreviewProps) {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [selectedContactId, setSelectedContactId] = useState(sampleContacts[0].id)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // Global header/footer come from settings, not the template, so the
  // preview has to pull them in to match what actually gets sent.
  const { data: branding } = useEmailBrandingConfig()

  const selectedContact = sampleContacts.find((c) => c.id === selectedContactId) || sampleContacts[0]

  // Generate HTML with sample data using the canonical merge-tag engine —
  // same one the prod email pipeline uses, so what you see here is what
  // the recipient actually gets. The "Test as" contact's fields are passed
  // as overrides so the preview body / subject / To: line all update
  // together when the user changes the dropdown. (Previously this ran a
  // second pass after `previewMergeTags` had already substituted the
  // sample contact, leaving no `{{first_name}}` tags for the override
  // pass to find — the dropdown looked broken.)
  const contactOverrides = {
    first_name: selectedContact.first_name,
    last_name: selectedContact.last_name,
    email: selectedContact.email,
  }
  const rawHtml = renderBlocksToHTML(blocks, settings.theme, branding?.rendered)
  const previewHtml = previewMergeTags(rawHtml, contactOverrides)

  // Update iframe content when HTML changes
  useEffect(() => {
    const updateIframe = () => {
      if (iframeRef.current) {
        const doc = iframeRef.current.contentDocument
        if (doc) {
          doc.open()
          doc.write(previewHtml)
          doc.close()
        }
      }
    }
    
    // Small delay to ensure iframe is mounted
    const timer = setTimeout(updateIframe, 50)
    return () => clearTimeout(timer)
  }, [previewHtml])

  const [isSending, setIsSending] = useState(false)
  const handleSendTestEmail = async () => {
    if (isSending) return
    setIsSending(true)
    try {
      const res = await fetch('/api/templates/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks, subject: settings.subject, theme: settings.theme ?? null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: 'Failed to send test',
          description: data.error || `HTTP ${res.status}`,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Test email sent',
          description: `Sent to ${data.sent_to || 'your email'}.`,
        })
      }
    } catch (err) {
      toast({
        title: 'Failed to send test',
        description: err instanceof Error ? err.message : 'Network error',
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="w-full bg-white dark:bg-slate-900 flex flex-col h-full">
      {/* Preview Header */}
      <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-700 space-y-2.5 shrink-0">
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-1.5">
            <div className="flex gap-1 rounded-md bg-slate-100 p-0.5 dark:bg-slate-800">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-6 w-6 p-0',
                  viewMode === 'desktop'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-700/60',
                )}
                onClick={() => setViewMode('desktop')}
                title="Desktop"
              >
                <Monitor className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-6 w-6 p-0',
                  viewMode === 'mobile'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-700/60',
                )}
                onClick={() => setViewMode('mobile')}
                title="Mobile"
              >
                <Smartphone className="h-3.5 w-3.5" />
              </Button>
            </div>
            {/* Send-test pill — small but labelled so the user can
                actually find it. Lives in the header next to the
                viewport toggle to keep the preview drawer compact (was
                a chunky full-width button at the bottom). */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendTestEmail}
              disabled={isSending || blocks.length === 0}
              className="h-7 gap-1.5 border-blue-200 bg-blue-50 px-2.5 text-[11px] font-medium text-blue-700 hover:border-blue-300 hover:bg-blue-100 hover:text-blue-800 disabled:opacity-50 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60"
              title={blocks.length === 0 ? 'Add a block first' : 'Send test email to yourself'}
            >
              {isSending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              {isSending ? 'Sending…' : 'Send test'}
            </Button>
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-6 w-6 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                title="Close preview"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Test as
          </Label>
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
        </div>
      </div>

      {/* Preview Content - Scrollable area */}
      <div className="flex-1 overflow-auto p-4 bg-slate-50 dark:bg-slate-800">
        <div
          className={cn(
            'mx-auto bg-white rounded-lg shadow-lg overflow-hidden',
            viewMode === 'desktop' ? 'w-full' : 'w-[320px]'
          )}
        >
          {/* Email Client Header */}
          <div className="bg-slate-100 px-3 py-2 border-b border-slate-200">
            <div className="text-xs text-slate-500 mb-0.5">
              <span className="text-slate-400">From:</span>{' '}
              {settings.fromNameType === 'deal_owner'
                ? 'Sarah Johnson (Deal Owner)'
                : settings.fixedFromName || 'IFG Team'}
            </div>
            <div className="text-xs text-slate-500 mb-1">
              <span className="text-slate-400">To:</span> {selectedContact.email}
            </div>
            <div className="text-sm font-semibold text-slate-800">
              {previewMergeTags(
                settings.subject || 'Enter your subject line...',
                contactOverrides,
              )}
            </div>
          </div>

          {/* Email Content - Iframe with srcDoc for better rendering */}
          <iframe
            ref={iframeRef}
            title="Email Preview"
            srcDoc={previewHtml}
            className="w-full border-0 block"
            style={{ 
              height: 'calc(100vh - 400px)',
              minHeight: '400px',
            }}
          />
        </div>
      </div>

    </div>
  )
}
