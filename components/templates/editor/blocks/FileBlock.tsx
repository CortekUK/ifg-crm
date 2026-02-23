'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Paperclip, Upload, X, FileText, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/hooks/use-toast'
import type { FileBlockContent } from '@/lib/templates/editor-types'

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
]

const ACCEPTED_EXTENSIONS = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface FileBlockProps {
  content: Record<string, unknown>
  isSelected: boolean
  onUpdate: (updates: Record<string, unknown>) => void
}

export function FileBlock({ content, isSelected, onUpdate }: FileBlockProps) {
  const fileContent = content as unknown as FileBlockContent
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const uploadFile = async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Accepted: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, ZIP',
        variant: 'destructive',
      })
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File too large',
        description: 'Please upload a file smaller than 10MB.',
        variant: 'destructive',
      })
      return
    }

    setIsUploading(true)
    const supabase = createClient()

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`
      const filePath = `email-templates/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath)

      onUpdate({
        fileName: file.name,
        fileUrl: publicUrl,
        fileSize: file.size,
        fileType: file.type,
      })

      toast({
        title: 'File uploaded',
        description: 'Your file has been uploaded successfully.',
      })
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: 'Upload failed',
        description: 'Failed to upload file. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleRemove = () => {
    onUpdate({ fileName: '', fileUrl: '', fileSize: 0, fileType: '' })
  }

  return (
    <div
      style={{
        paddingTop: `${fileContent.paddingTop ?? 10}px`,
        paddingBottom: `${fileContent.paddingBottom ?? 10}px`,
        textAlign: fileContent.alignment || 'left',
      }}
    >
      {fileContent.fileUrl ? (
        <div className="inline-flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-center w-10 h-10 bg-blue-50 rounded-lg">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-700 truncate max-w-[200px]">
              {fileContent.fileName}
            </p>
            <p className="text-xs text-gray-500">
              {formatFileSize(fileContent.fileSize)}
            </p>
          </div>
          {isSelected && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-red-500"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`inline-flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
            isDragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400'
          }`}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
              <span className="text-sm text-gray-500">Uploading...</span>
            </>
          ) : (
            <>
              <Paperclip className="h-8 w-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-500 mb-2">
                Drag & drop a file here
              </span>
              <label>
                <input
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  onChange={handleFileInput}
                  className="hidden"
                  disabled={isUploading}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  onClick={(e) => {
                    e.preventDefault()
                    const input = e.currentTarget.previousElementSibling as HTMLInputElement
                    input?.click()
                  }}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File
                </Button>
              </label>
              <span className="text-xs text-gray-400 mt-2">
                PDF, DOC, XLS, PPT, ZIP (max 10MB)
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
