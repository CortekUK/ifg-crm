'use client'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserCircle, Mail, Phone, Calendar, AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RecruiterSignatureBlockContent } from '@/lib/templates/editor-types'
import { Button } from '@/components/ui/button'

interface RecruiterSignatureBlockProps {
  content: Record<string, unknown>
  isSelected: boolean
  onUpdate: (updates: Record<string, unknown>) => void
}

export function RecruiterSignatureBlock({ content, isSelected, onUpdate }: RecruiterSignatureBlockProps) {
  const signatureContent = content as unknown as RecruiterSignatureBlockContent

  const photoSizeMap = {
    small: 40,
    medium: 60,
    large: 80,
  }

  const photoSize = photoSizeMap[signatureContent.photoSize || 'medium']

  return (
    <div
      style={{
        paddingTop: `${signatureContent.paddingTop || 20}px`,
        paddingBottom: `${signatureContent.paddingBottom || 10}px`,
      }}
    >
      {/* Settings panel when selected */}
      {isSelected && (
        <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <UserCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Recruiter Signature Settings
            </span>
          </div>

          <p className="text-xs text-amber-600 dark:text-amber-400">
            This block automatically shows the deal owner's information at send time.
          </p>

          {/* Toggle options */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-600 dark:text-slate-400">Photo</Label>
              <Switch
                checked={signatureContent.showPhoto !== false}
                onCheckedChange={(checked) => onUpdate({ showPhoto: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-600 dark:text-slate-400">Name</Label>
              <Switch
                checked={signatureContent.showName !== false}
                onCheckedChange={(checked) => onUpdate({ showName: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-600 dark:text-slate-400">Title</Label>
              <Switch
                checked={signatureContent.showTitle !== false}
                onCheckedChange={(checked) => onUpdate({ showTitle: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-600 dark:text-slate-400">Email</Label>
              <Switch
                checked={signatureContent.showEmail !== false}
                onCheckedChange={(checked) => onUpdate({ showEmail: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-600 dark:text-slate-400">Phone</Label>
              <Switch
                checked={signatureContent.showPhone !== false}
                onCheckedChange={(checked) => onUpdate({ showPhone: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-600 dark:text-slate-400">Calendly</Label>
              <Switch
                checked={signatureContent.showCalendly !== false}
                onCheckedChange={(checked) => onUpdate({ showCalendly: checked })}
              />
            </div>
          </div>

          {/* Layout and alignment */}
          <div className="flex items-center gap-4 pt-2 border-t border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-600 dark:text-slate-400">Layout:</Label>
              <Select
                value={signatureContent.layout || 'inline'}
                onValueChange={(v) => onUpdate({ layout: v })}
              >
                <SelectTrigger className="h-7 w-24 text-xs bg-white dark:bg-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inline">Inline</SelectItem>
                  <SelectItem value="stacked">Stacked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-600 dark:text-slate-400">Photo Size:</Label>
              <Select
                value={signatureContent.photoSize || 'medium'}
                onValueChange={(v) => onUpdate({ photoSize: v })}
              >
                <SelectTrigger className="h-7 w-20 text-xs bg-white dark:bg-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1">
              <Label className="text-xs text-slate-600 dark:text-slate-400 mr-1">Align:</Label>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-7 w-7', signatureContent.alignment === 'left' && 'bg-amber-200 dark:bg-amber-800')}
                onClick={() => onUpdate({ alignment: 'left' })}
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-7 w-7', signatureContent.alignment === 'center' && 'bg-amber-200 dark:bg-amber-800')}
                onClick={() => onUpdate({ alignment: 'center' })}
              >
                <AlignCenter className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-7 w-7', signatureContent.alignment === 'right' && 'bg-amber-200 dark:bg-amber-800')}
                onClick={() => onUpdate({ alignment: 'right' })}
              >
                <AlignRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Preview */}
      <div
        className={cn(
          'rounded-lg p-4',
          isSelected
            ? 'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700'
            : ''
        )}
        style={{ textAlign: signatureContent.alignment || 'left' }}
      >
        <div
          className={cn(
            signatureContent.layout === 'inline' ? 'flex items-start gap-4' : 'flex flex-col items-center gap-2',
            signatureContent.alignment === 'center' && 'justify-center',
            signatureContent.alignment === 'right' && 'justify-end'
          )}
        >
          {/* Photo placeholder */}
          {signatureContent.showPhoto !== false && (
            <div
              className="rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold shrink-0"
              style={{ width: photoSize, height: photoSize, fontSize: photoSize * 0.4 }}
            >
              <span>DO</span>
            </div>
          )}

          {/* Details */}
          <div className={cn(signatureContent.layout === 'stacked' && 'text-center')}>
            {signatureContent.showName !== false && (
              <p className="font-semibold text-slate-900 dark:text-white">
                {'{{deal_owner_name}}'}
              </p>
            )}
            {signatureContent.showTitle !== false && (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {'{{deal_owner_title}}'}
              </p>
            )}
            <div className={cn('mt-2 space-y-1', signatureContent.layout === 'stacked' && 'flex flex-col items-center')}>
              {signatureContent.showEmail !== false && (
                <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  {'{{deal_owner_email}}'}
                </p>
              )}
              {signatureContent.showPhone !== false && (
                <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {'{{deal_owner_phone}}'}
                </p>
              )}
              {signatureContent.showCalendly !== false && (
                <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="underline">Book a call with me</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
