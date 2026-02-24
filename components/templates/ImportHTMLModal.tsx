'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Upload, FileCode, Loader2, X } from 'lucide-react'
import { useCreateTemplate } from '@/lib/hooks/useTemplates'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/hooks/use-toast'

interface ImportHTMLModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (templateId: string) => void
}

export function ImportHTMLModal({ isOpen, onClose, onSuccess }: ImportHTMLModalProps) {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [html, setHtml] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const createTemplate = useCreateTemplate()

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setName('')
      setSubject('')
      setHtml('')
      setFileName(null)
    }
  }, [isOpen])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm') && file.type !== 'text/html') {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an HTML file (.html or .htm).',
        variant: 'destructive',
      })
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an HTML file smaller than 2MB.',
        variant: 'destructive',
      })
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setHtml(content)
      setFileName(file.name)
      // Auto-fill name from filename if empty
      if (!name) {
        setName(file.name.replace(/\.(html|htm)$/i, '').replace(/[-_]/g, ' '))
      }
    }
    reader.readAsText(file)
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: 'Name required', description: 'Please enter a template name.', variant: 'destructive' })
      return
    }
    if (!subject.trim()) {
      toast({ title: 'Subject required', description: 'Please enter an email subject line.', variant: 'destructive' })
      return
    }
    if (!html.trim()) {
      toast({ title: 'HTML required', description: 'Please paste HTML or upload an HTML file.', variant: 'destructive' })
      return
    }

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const template = await createTemplate.mutateAsync({
        name: name.trim(),
        subject: subject.trim(),
        body_html: html,
        category: 'campaign',
        from_name_type: 'deal_owner',
        created_by_id: user.id,
      })

      toast({
        title: 'Template imported',
        description: `"${name.trim()}" has been created from HTML.`,
      })
      onClose()
      onSuccess?.(template.id)
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Failed to create template.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
            Import HTML Template
          </DialogTitle>
          <DialogDescription>
            Paste HTML code or upload an HTML file to create a new email template.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Name */}
          <div className="space-y-2">
            <Label htmlFor="import-name">Template Name</Label>
            <Input
              id="import-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Welcome Email"
            />
          </div>

          {/* Subject Line */}
          <div className="space-y-2">
            <Label htmlFor="import-subject">Subject Line</Label>
            <Input
              id="import-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Welcome to {{programme_name}}"
            />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Upload HTML File</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm,text/html"
              onChange={handleFileUpload}
              className="hidden"
            />
            {fileName ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                <FileCode className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-800 dark:text-green-200 flex-1 truncate">{fileName}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setFileName(null)
                    setHtml('')
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose HTML File
              </Button>
            )}
          </div>

          {/* Or Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or paste HTML</span>
            </div>
          </div>

          {/* HTML Textarea */}
          <div className="space-y-2">
            <Label htmlFor="import-html">HTML Code</Label>
            <Textarea
              id="import-html"
              value={html}
              onChange={(e) => {
                setHtml(e.target.value)
                if (fileName) setFileName(null)
              }}
              placeholder="<html>&#10;  <body>&#10;    <h1>Your email content...</h1>&#10;  </body>&#10;</html>"
              className="font-mono text-sm min-h-[160px]"
            />
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createTemplate.isPending || !name.trim() || !subject.trim() || !html.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {createTemplate.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import Template
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
