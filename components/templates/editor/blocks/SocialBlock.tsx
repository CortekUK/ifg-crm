'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SocialBlockContent } from '@/lib/templates/editor-types'

interface SocialBlockProps {
  content: Record<string, unknown>
  isSelected: boolean
  onUpdate: (updates: Record<string, unknown>) => void
}

const socialPlatforms: {
  key: keyof SocialBlockContent['platforms']
  label: string
  color: string
  icon: string
}[] = [
  { key: 'facebook', label: 'Facebook', color: '#1877f2', icon: 'f' },
  { key: 'twitter', label: 'Twitter', color: '#1da1f2', icon: '𝕏' },
  { key: 'instagram', label: 'Instagram', color: '#e4405f', icon: '📷' },
  { key: 'linkedin', label: 'LinkedIn', color: '#0a66c2', icon: 'in' },
  { key: 'youtube', label: 'YouTube', color: '#ff0000', icon: '▶' },
]

export function SocialBlock({ content, isSelected, onUpdate }: SocialBlockProps) {
  const socialContent = content as unknown as SocialBlockContent

  const updatePlatform = (
    platform: keyof SocialBlockContent['platforms'],
    updates: Partial<SocialBlockContent['platforms'][typeof platform]>
  ) => {
    onUpdate({
      platforms: {
        ...socialContent.platforms,
        [platform]: {
          ...socialContent.platforms[platform],
          ...updates,
        },
      },
    })
  }

  const enabledPlatforms = socialPlatforms.filter(
    (p) => socialContent.platforms[p.key].enabled
  )

  return (
    <div className="py-2">
      {/* Settings panel when selected */}
      {isSelected && (
        <div className="space-y-3 mb-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Style:</Label>
              <select
                value={socialContent.style}
                onChange={(e) =>
                  onUpdate({ style: e.target.value as 'coloured' | 'monochrome' })
                }
                className="h-7 px-2 text-xs border rounded"
              >
                <option value="coloured">Coloured</option>
                <option value="monochrome">Monochrome</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs">Align:</Label>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-7 w-7', socialContent.alignment === 'left' && 'bg-gray-200')}
                  onClick={() => onUpdate({ alignment: 'left' })}
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-7 w-7', socialContent.alignment === 'center' && 'bg-gray-200')}
                  onClick={() => onUpdate({ alignment: 'center' })}
                >
                  <AlignCenter className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-7 w-7', socialContent.alignment === 'right' && 'bg-gray-200')}
                  onClick={() => onUpdate({ alignment: 'right' })}
                >
                  <AlignRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Platforms</Label>
            {socialPlatforms.map((platform) => (
              <div key={platform.key} className="flex items-center gap-3">
                <Switch
                  checked={socialContent.platforms[platform.key].enabled}
                  onCheckedChange={(checked) =>
                    updatePlatform(platform.key, { enabled: checked })
                  }
                />
                <span className="text-xs w-20">{platform.label}</span>
                <Input
                  value={socialContent.platforms[platform.key].url}
                  onChange={(e) =>
                    updatePlatform(platform.key, { url: e.target.value })
                  }
                  placeholder={`${platform.label} URL`}
                  className="h-7 text-xs flex-1"
                  disabled={!socialContent.platforms[platform.key].enabled}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Social Icons Preview */}
      <div style={{ textAlign: socialContent.alignment }} className="py-2">
        {enabledPlatforms.length === 0 ? (
          <div className="text-sm text-gray-400 text-center">
            Enable social platforms above
          </div>
        ) : (
          <div className="inline-flex gap-2">
            {enabledPlatforms.map((platform) => (
              <a
                key={platform.key}
                href={socialContent.platforms[platform.key].url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.preventDefault()}
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{
                  backgroundColor:
                    socialContent.style === 'coloured' ? platform.color : '#6b7280',
                }}
              >
                {platform.icon}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
