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
import { Monitor, Smartphone, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { renderBlocksToHTML, replaceVariables } from '@/lib/templates/render-html'
import { sampleContacts, TemplateSettings, EditorBlock } from '@/lib/templates/editor-types'
import { toast } from '@/lib/hooks/use-toast'

interface EditorPreviewProps {
  blocks: EditorBlock[]
  settings: TemplateSettings
}

export function EditorPreview({ blocks, settings }: EditorPreviewProps) {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [selectedContactId, setSelectedContactId] = useState(sampleContacts[0].id)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const selectedContact = sampleContacts.find((c) => c.id === selectedContactId) || sampleContacts[0]

  // Generate HTML with sample data
  const rawHtml = renderBlocksToHTML(blocks)
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

  const handleSendTestEmail = () => {
    toast({
      title: 'Test email sent',
      description: 'A test email has been sent to your email address.',
    })
  }

  return (
    <div className="w-[400px] border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col h-full">
      {/* Preview Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-4 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase">Preview</h3>
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 w-7 p-0',
                viewMode === 'desktop' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
              onClick={() => setViewMode('desktop')}
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 w-7 p-0',
                viewMode === 'mobile' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
              onClick={() => setViewMode('mobile')}
            >
              <Smartphone className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500 dark:text-slate-400">Test Data</Label>
          <Select value={selectedContactId} onValueChange={setSelectedContactId}>
            <SelectTrigger className="h-9 text-sm">
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
              {replaceVariables(settings.subject || 'Enter your subject line...', {
                first_name: selectedContact.first_name,
                last_name: selectedContact.last_name,
              })}
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

      {/* Send Test Email */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
        <Button 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          onClick={handleSendTestEmail}
        >
          <Send className="h-4 w-4 mr-2" />
          Send Test Email
        </Button>
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-2">
          Send to your logged-in email address
        </p>
      </div>
    </div>
  )
}
