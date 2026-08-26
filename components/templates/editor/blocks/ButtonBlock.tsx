'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { AlignLeft, AlignCenter, AlignRight, Plus, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { templateVariables, ButtonBlockContent } from '@/lib/templates/editor-types'
import { SharedLinksDialog } from '../SharedLinksDialog'
import { useEmailBrandingConfig } from '@/lib/hooks/useEmailBranding'
import type { BrandingLink } from '@/lib/templates/branding-types'

interface ButtonBlockProps {
  content: Record<string, unknown>
  isSelected: boolean
  onUpdate: (updates: Record<string, unknown>) => void
}

export function ButtonBlock({ content, isSelected, onUpdate }: ButtonBlockProps) {
  const buttonContent = content as unknown as ButtonBlockContent
  const [linksOpen, setLinksOpen] = useState(false)
  const { data: branding } = useEmailBrandingConfig()
  const sharedLinks = branding?.config.links ?? []

  const insertVariable = (variable: string) => {
    onUpdate({ url: (buttonContent.url || '') + variable })
  }

  /**
   * Point the button at a shared link. The current destination is kept as
   * the tag's fallback, so the button still works if the shared link is
   * ever unavailable at send time — the same belt-and-braces the Calendly
   * buttons already use.
   */
  const useSharedLink = (link: BrandingLink) =>
    onUpdate({ url: `{{${link.key}|${link.url}}}` })

  // Which shared link, if any, this button currently follows.
  const activeKey = (buttonContent.url || '').match(/^\{\{(\w+)/)?.[1] ?? null
  const activeLink = sharedLinks.find((l) => l.key === activeKey) ?? null

  return (
    <div
      style={{
        paddingTop: `${buttonContent.paddingTop}px`,
        paddingBottom: `${buttonContent.paddingBottom}px`,
      }}
    >
      {/* Settings panel when selected */}
      {isSelected && (
        <div className="space-y-3 mb-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <div className="flex items-center gap-2">
            <Label className="text-xs w-20">Button text:</Label>
            <Input
              value={buttonContent.text}
              onChange={(e) => onUpdate({ text: e.target.value })}
              placeholder="Click Here"
              className="h-8 text-sm flex-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs w-20">URL:</Label>
            <Input
              value={buttonContent.url}
              onChange={(e) => onUpdate({ url: e.target.value })}
              placeholder="https://example.com"
              className="h-8 text-sm flex-1"
            />
            <Button
              variant={activeLink ? 'secondary' : 'outline'}
              size="sm"
              className="h-8 shrink-0"
              onClick={() => setLinksOpen(true)}
              title="Use a shared link — set once, updates every button that uses it"
            >
              <Link2 className="h-3 w-3" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Plus className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <div className="space-y-1">
                  {templateVariables.map((v) => (
                    <button
                      key={v.value}
                      onClick={() => insertVariable(v.value)}
                      className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100"
                    >
                      <div className="font-medium">{v.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{v.value}</div>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {activeLink ? (
            <p className="ml-[5.5rem] flex items-center gap-1.5 text-[11px] text-indigo-600 dark:text-indigo-400">
              <Link2 className="h-3 w-3 shrink-0" />
              <span>
                Follows the shared link <strong>{activeLink.label}</strong> —
                change it once and every button using it updates.
              </span>
            </p>
          ) : (
            sharedLinks.length > 0 && (
              <p className="ml-[5.5rem] text-[11px] text-muted-foreground">
                This URL applies to this button only. Use a shared link to
                manage it across every template at once.
              </p>
            )
          )}

          <SharedLinksDialog
            open={linksOpen}
            onOpenChange={setLinksOpen}
            onInsert={useSharedLink}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Background:</Label>
              <input
                type="color"
                value={buttonContent.backgroundColor}
                onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
                className="h-7 w-10 rounded cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Text colour:</Label>
              <input
                type="color"
                value={buttonContent.textColor}
                onChange={(e) => onUpdate({ textColor: e.target.value })}
                className="h-7 w-10 rounded cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs w-20">Radius:</Label>
            <Slider
              value={[buttonContent.borderRadius]}
              onValueChange={([value]) => onUpdate({ borderRadius: value })}
              max={20}
              step={1}
              className="flex-1"
            />
            <span className="text-xs text-gray-500 w-8">{buttonContent.borderRadius}px</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Width:</Label>
              <select
                value={buttonContent.width}
                onChange={(e) => onUpdate({ width: e.target.value })}
                className="h-7 px-2 text-xs border rounded bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
              >
                <option value="auto">Auto</option>
                <option value="full">Full width</option>
                <option value="50">50%</option>
                <option value="75">75%</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs">Align:</Label>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-7 w-7', buttonContent.alignment === 'left' && 'bg-gray-200 dark:bg-slate-600')}
                  onClick={() => onUpdate({ alignment: 'left' })}
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-7 w-7', buttonContent.alignment === 'center' && 'bg-gray-200 dark:bg-slate-600')}
                  onClick={() => onUpdate({ alignment: 'center' })}
                >
                  <AlignCenter className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-7 w-7', buttonContent.alignment === 'right' && 'bg-gray-200 dark:bg-slate-600')}
                  onClick={() => onUpdate({ alignment: 'right' })}
                >
                  <AlignRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Padding:</Label>
              <Input
                type="number"
                value={buttonContent.paddingTop}
                onChange={(e) => onUpdate({ paddingTop: parseInt(e.target.value) || 0, paddingBottom: parseInt(e.target.value) || 0 })}
                className="h-6 w-14 text-xs"
                min={0}
                max={50}
              />
              <span className="text-gray-400 text-xs">px</span>
            </div>
          </div>
        </div>
      )}

      {/* Button Preview */}
      <div style={{ textAlign: buttonContent.alignment }}>
        <a
          href={buttonContent.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: buttonContent.width === 'full' || buttonContent.width === '50' || buttonContent.width === '75' ? 'block' : 'inline-block',
            width: buttonContent.width === 'full' ? '100%' : buttonContent.width === '50' ? '50%' : buttonContent.width === '75' ? '75%' : 'auto',
            backgroundColor: buttonContent.backgroundColor,
            color: buttonContent.textColor,
            padding: `${buttonContent.paddingY ?? 12}px ${buttonContent.paddingX ?? 24}px`,
            textDecoration: 'none',
            borderRadius: `${buttonContent.borderRadius}px`,
            fontWeight: 'bold',
            textAlign: 'center',
            margin: buttonContent.alignment === 'center' ? '0 auto' : buttonContent.alignment === 'right' ? '0 0 0 auto' : undefined,
          }}
          onClick={(e) => e.preventDefault()}
        >
          {buttonContent.text || 'Click Here'}
        </a>
      </div>
    </div>
  )
}
