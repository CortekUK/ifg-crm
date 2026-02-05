'use client'

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

  const selectedContact = sampleContacts.find((c) => c.id === selectedContactId) || sampleContacts[0]

  // Generate preview HTML with sample data
  const previewHtml = template?.body_html 
    ? previewMergeTags(template.body_html)
    : '<p style="padding: 20px; text-align: center; color: #666;">No content</p>'

  const previewSubject = template?.subject
    ? previewMergeTags(template.subject)
    : 'No subject'

  // Update iframe content when HTML changes
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
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              Preview: {template.name}
            </DialogTitle>
            <div className="flex items-center gap-4">
              {/* View Mode Toggle */}
              <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-8 w-8 p-0',
                    viewMode === 'desktop'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  )}
                  onClick={() => setViewMode('desktop')}
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-8 w-8 p-0',
                    viewMode === 'mobile'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  )}
                  onClick={() => setViewMode('mobile')}
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>

              {/* Sample Contact Selector */}
              <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                <SelectTrigger className="w-[180px] h-9">
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
        </DialogHeader>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto p-6 bg-slate-100 dark:bg-slate-900">
          <div
            className={cn(
              'mx-auto bg-white rounded-lg shadow-lg overflow-hidden transition-all',
              viewMode === 'desktop' ? 'max-w-[600px]' : 'max-w-[375px]'
            )}
          >
            {/* Email Header */}
            <div className="bg-slate-50 px-4 py-3 border-b">
              <div className="text-xs text-slate-500 mb-1">
                <span className="text-slate-400">From:</span>{' '}
                {template.from_name_type === 'deal_owner'
                  ? 'Deal Owner (dynamic)'
                  : template.fixed_from_name || 'IFG Team'}
              </div>
              <div className="text-xs text-slate-500 mb-2">
                <span className="text-slate-400">To:</span> {selectedContact.email}
              </div>
              <div className="text-sm font-semibold text-slate-800">
                {previewSubject}
              </div>
            </div>

            {/* Email Body */}
            <iframe
              ref={iframeRef}
              title="Email Preview"
              className="w-full border-0 block"
              style={{ 
                height: 'calc(90vh - 200px)',
                minHeight: '400px',
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
