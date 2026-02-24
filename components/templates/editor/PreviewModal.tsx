'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Monitor, Smartphone, Send, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { renderBlocksToHTML, replaceVariables } from '@/lib/templates/render-html'
import { sampleContacts, TemplateSettings, EditorBlock } from '@/lib/templates/editor-types'
import { toast } from '@/lib/hooks/use-toast'

interface PreviewModalProps {
  isOpen: boolean
  onClose: () => void
  blocks: EditorBlock[]
  settings: TemplateSettings
}

export function PreviewModal({ isOpen, onClose, blocks, settings }: PreviewModalProps) {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [selectedContactId, setSelectedContactId] = useState(sampleContacts[0].id)
  const [testEmail, setTestEmail] = useState('')
  const [isSendingTest, setIsSendingTest] = useState(false)
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

  const handleSendTest = async () => {
    if (!testEmail) {
      toast({
        title: 'Enter email address',
        description: 'Please enter an email address to send the test to.',
        variant: 'destructive',
      })
      return
    }

    setIsSendingTest(true)

    // Simulate sending - in real app, this would call an API
    await new Promise((resolve) => setTimeout(resolve, 1500))

    toast({
      title: 'Test email sent',
      description: `A preview has been sent to ${testEmail}.`,
    })

    setIsSendingTest(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
              Email Preview
            </DialogTitle>
            <div className="flex items-center gap-4">
              {/* View Mode Toggle */}
              <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-8 px-3',
                    viewMode === 'desktop' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  )}
                  onClick={() => setViewMode('desktop')}
                >
                  <Monitor className="h-4 w-4 mr-2" />
                  Desktop
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-8 px-3',
                    viewMode === 'mobile' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  )}
                  onClick={() => setViewMode('mobile')}
                >
                  <Smartphone className="h-4 w-4 mr-2" />
                  Mobile
                </Button>
              </div>

              {/* Test Data Selector */}
              <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                <SelectTrigger className="w-40 h-9">
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

              {/* Send Test Email */}
              <div className="flex items-center gap-2">
                <Input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                  className="w-48 h-9"
                />
                <Button 
                  onClick={handleSendTest} 
                  disabled={isSendingTest}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSendingTest ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Test
                    </>
                  )}
                </Button>
              </div>

              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 p-8">
          <div className="flex justify-center">
            <div
              className={cn(
                'bg-white rounded-lg shadow-lg overflow-hidden transition-all',
                viewMode === 'desktop' ? 'w-[600px]' : 'w-[375px]'
              )}
            >
              {/* Email Client Header */}
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-400 w-14">From:</span>
                    <span className="text-slate-700">
                      {settings.fromNameType === 'deal_owner'
                        ? 'Sarah Johnson'
                        : settings.fixedFromName || 'IFG Team'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-400 w-14">To:</span>
                    <span className="text-slate-700">{selectedContact.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-400 w-14">Subject:</span>
                    <span className="font-semibold text-slate-900">
                      {replaceVariables(settings.subject || 'Enter your subject line...', {
                        first_name: selectedContact.first_name,
                        last_name: selectedContact.last_name,
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Email Content - Using iframe to properly render full HTML document */}
              <iframe
                ref={iframeRef}
                title="Email Preview"
                className="w-full border-0"
                style={{ 
                  height: '600px',
                  minHeight: '600px',
                }}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
