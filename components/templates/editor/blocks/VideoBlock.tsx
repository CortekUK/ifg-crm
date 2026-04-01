'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlignLeft, AlignCenter, AlignRight, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VideoBlockContent } from '@/lib/templates/editor-types'

interface VideoBlockProps {
  content: Record<string, unknown>
  isSelected: boolean
  onUpdate: (updates: Record<string, unknown>) => void
}

function getVideoThumbnail(url: string): string | null {
  // YouTube
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
  if (youtubeMatch) {
    return `https://img.youtube.com/vi/${youtubeMatch[1]}/maxresdefault.jpg`
  }

  // Vimeo - would need API call, return null
  return null
}

export function VideoBlock({ content, isSelected, onUpdate }: VideoBlockProps) {
  const videoContent = content as unknown as VideoBlockContent
  const thumbnailUrl = videoContent.thumbnailUrl || (videoContent.url ? getVideoThumbnail(videoContent.url) : null)

  return (
    <div className="py-2">
      {/* Settings panel when selected */}
      {isSelected && (
        <div className="space-y-3 mb-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <div className="flex items-center gap-2">
            <Label className="text-xs w-20">Video URL:</Label>
            <Input
              value={videoContent.url}
              onChange={(e) => onUpdate({ url: e.target.value })}
              placeholder="YouTube or Vimeo URL"
              className="h-8 text-sm flex-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs w-20">Thumbnail:</Label>
            <Input
              value={videoContent.thumbnailUrl || ''}
              onChange={(e) => onUpdate({ thumbnailUrl: e.target.value })}
              placeholder="Custom thumbnail URL (optional)"
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
                  className={cn('h-7 w-7', videoContent.alignment === 'left' && 'bg-gray-200 dark:bg-slate-600')}
                  onClick={() => onUpdate({ alignment: 'left' })}
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-7 w-7', videoContent.alignment === 'center' && 'bg-gray-200 dark:bg-slate-600')}
                  onClick={() => onUpdate({ alignment: 'center' })}
                >
                  <AlignCenter className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-7 w-7', videoContent.alignment === 'right' && 'bg-gray-200 dark:bg-slate-600')}
                  onClick={() => onUpdate({ alignment: 'right' })}
                >
                  <AlignRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs">Width:</Label>
              <select
                value={videoContent.width === 'full' ? 'full' : videoContent.width?.toString() || 'full'}
                onChange={(e) =>
                  onUpdate({
                    width: e.target.value === 'full' ? 'full' : parseInt(e.target.value),
                  })
                }
                className="h-7 px-2 text-xs border rounded bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
              >
                <option value="full">Full width</option>
                <option value="500">500px</option>
                <option value="400">400px</option>
                <option value="300">300px</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Video Preview */}
      <div style={{ textAlign: videoContent.alignment }}>
        {thumbnailUrl ? (
          <a
            href={videoContent.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="relative inline-block"
            onClick={(e) => e.preventDefault()}
          >
            <img
              src={thumbnailUrl}
              alt="Video thumbnail"
              style={{
                width: videoContent.width === 'full' ? '100%' : `${videoContent.width}px`,
                maxWidth: '100%',
                height: 'auto',
                display: 'block',
              }}
              className="rounded"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 bg-black/70 rounded-full flex items-center justify-center">
                <Play className="h-8 w-8 text-white ml-1" fill="white" />
              </div>
            </div>
          </a>
        ) : (
          <div
            className="inline-flex flex-col items-center justify-center bg-slate-900 rounded text-white"
            style={{
              width: videoContent.width === 'full' ? '100%' : `${videoContent.width}px`,
              maxWidth: '100%',
              aspectRatio: '16/9',
            }}
          >
            <Play className="h-12 w-12 mb-2" />
            <span className="text-sm">
              {videoContent.url ? 'Video' : 'Add video URL'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
