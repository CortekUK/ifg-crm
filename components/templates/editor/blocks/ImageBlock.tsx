'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Image, Upload, AlignLeft, AlignCenter, AlignRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/hooks/use-toast'
import type { ImageBlockContent } from '@/lib/templates/editor-types'

interface ImageBlockProps {
  content: Record<string, unknown>
  isSelected: boolean
  onUpdate: (updates: Record<string, unknown>) => void
}

export function ImageBlock({ content, isSelected, onUpdate }: ImageBlockProps) {
  const imageContent = content as unknown as ImageBlockContent
  const [isUploading, setIsUploading] = useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file.',
        variant: 'destructive',
      })
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB.',
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

      onUpdate({ src: publicUrl })

      toast({
        title: 'Image uploaded',
        description: 'Your image has been uploaded successfully.',
      })
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: 'Upload failed',
        description: 'Failed to upload image. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="py-2">
      {/* Settings panel when selected */}
      {isSelected && (
        <div className="space-y-3 mb-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Label className="text-xs w-16">Upload:</Label>
            <label className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUploading}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={isUploading}
                onClick={(e) => {
                  e.preventDefault()
                  const input = e.currentTarget.previousElementSibling as HTMLInputElement
                  input?.click()
                }}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Image
                  </>
                )}
              </Button>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs w-16">URL:</Label>
            <Input
              value={imageContent.src}
              onChange={(e) => onUpdate({ src: e.target.value })}
              placeholder="https://example.com/image.jpg"
              className="h-8 text-sm flex-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs w-16">Alt text:</Label>
            <Input
              value={imageContent.alt}
              onChange={(e) => onUpdate({ alt: e.target.value })}
              placeholder="Image description"
              className="h-8 text-sm flex-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs w-16">Link URL:</Label>
            <Input
              value={imageContent.linkUrl || ''}
              onChange={(e) => onUpdate({ linkUrl: e.target.value })}
              placeholder="Optional click URL"
              className="h-8 text-sm flex-1"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Align:</Label>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-7 w-7', imageContent.alignment === 'left' && 'bg-gray-200')}
                  onClick={() => onUpdate({ alignment: 'left' })}
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-7 w-7', imageContent.alignment === 'center' && 'bg-gray-200')}
                  onClick={() => onUpdate({ alignment: 'center' })}
                >
                  <AlignCenter className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-7 w-7', imageContent.alignment === 'right' && 'bg-gray-200')}
                  onClick={() => onUpdate({ alignment: 'right' })}
                >
                  <AlignRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs">Width:</Label>
              <select
                value={imageContent.width === 'full' ? 'full' : imageContent.width?.toString() || 'full'}
                onChange={(e) =>
                  onUpdate({
                    width: e.target.value === 'full' ? 'full' : parseInt(e.target.value),
                  })
                }
                className="h-7 px-2 text-xs border rounded"
              >
                <option value="full">Full width</option>
                <option value="400">400px</option>
                <option value="300">300px</option>
                <option value="200">200px</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview */}
      <div style={{ textAlign: imageContent.alignment }}>
        {imageContent.src ? (
          <img
            src={imageContent.src}
            alt={imageContent.alt}
            style={{
              width: imageContent.width === 'full' ? '100%' : `${imageContent.width}px`,
              maxWidth: '100%',
              height: 'auto',
              display: 'inline-block',
            }}
            className="rounded"
          />
        ) : (
          <div className="inline-flex flex-col items-center justify-center p-8 bg-gray-100 rounded border-2 border-dashed border-gray-300 text-gray-400">
            <Image className="h-8 w-8 mb-2" />
            <span className="text-sm">No image selected</span>
          </div>
        )}
      </div>
    </div>
  )
}
