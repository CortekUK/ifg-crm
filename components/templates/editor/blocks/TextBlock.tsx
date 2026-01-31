'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Bold,
  Italic,
  Underline,
  Link,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TextBlockContent } from '@/lib/templates/editor-types'
import { MergeTagDropdown } from '../MergeTagDropdown'

interface TextBlockProps {
  content: Record<string, unknown>
  isSelected: boolean
  onUpdate: (updates: Record<string, unknown>) => void
}

export function TextBlock({ content, isSelected, onUpdate }: TextBlockProps) {
  const textContent = content as unknown as TextBlockContent
  const editorRef = useRef<HTMLDivElement>(null)
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== textContent.html) {
      editorRef.current.innerHTML = textContent.html
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleInput = () => {
    if (editorRef.current) {
      onUpdate({ html: editorRef.current.innerHTML })
    }
  }

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    handleInput()
  }

  const insertVariable = (variable: string) => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const node = document.createTextNode(variable)
      range.insertNode(node)
      range.setStartAfter(node)
      range.setEndAfter(node)
      selection.removeAllRanges()
      selection.addRange(range)
    } else if (editorRef.current) {
      editorRef.current.innerHTML += variable
    }
    handleInput()
  }

  const handleAddLink = () => {
    if (linkUrl) {
      execCommand('createLink', linkUrl)
      setLinkUrl('')
      setShowLinkInput(false)
    }
  }

  const fontSize = textContent.fontSize === 'small' ? 'text-sm' : textContent.fontSize === 'large' ? 'text-lg' : 'text-base'

  return (
    <div
      style={{
        paddingTop: `${textContent.paddingTop}px`,
        paddingBottom: `${textContent.paddingBottom}px`,
        backgroundColor: textContent.backgroundColor || 'transparent',
      }}
    >
      {/* Toolbar - only show when selected */}
      {isSelected && (
        <div className="flex items-center gap-1 mb-2 p-1 bg-gray-100 rounded-lg flex-wrap">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => execCommand('bold')}
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => execCommand('italic')}
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => execCommand('underline')}
          >
            <Underline className="h-3.5 w-3.5" />
          </Button>

          <div className="w-px h-5 bg-gray-300 mx-1" />

          <Popover open={showLinkInput} onOpenChange={setShowLinkInput}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Link className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3">
              <div className="space-y-2">
                <Label className="text-xs">Link URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://"
                    className="h-8 text-sm"
                  />
                  <Button size="sm" onClick={handleAddLink}>
                    Add
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div className="w-px h-5 bg-gray-300 mx-1" />

          <Button
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7', textContent.alignment === 'left' && 'bg-gray-200')}
            onClick={() => onUpdate({ alignment: 'left' })}
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7', textContent.alignment === 'center' && 'bg-gray-200')}
            onClick={() => onUpdate({ alignment: 'center' })}
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7', textContent.alignment === 'right' && 'bg-gray-200')}
            onClick={() => onUpdate({ alignment: 'right' })}
          >
            <AlignRight className="h-3.5 w-3.5" />
          </Button>

          <div className="w-px h-5 bg-gray-300 mx-1" />

          <select
            value={textContent.fontSize}
            onChange={(e) => onUpdate({ fontSize: e.target.value as TextBlockContent['fontSize'] })}
            className="h-7 px-2 text-xs border rounded"
          >
            <option value="small">Small</option>
            <option value="normal">Normal</option>
            <option value="large">Large</option>
          </select>

          <div className="w-px h-5 bg-gray-300 mx-1" />

          <MergeTagDropdown onInsert={insertVariable} variant="compact" />
        </div>
      )}

      {/* Settings panel when selected */}
      {isSelected && (
        <div className="flex items-center gap-4 mb-2 text-xs">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Padding:</Label>
            <Input
              type="number"
              value={textContent.paddingTop}
              onChange={(e) => onUpdate({ paddingTop: parseInt(e.target.value) || 0 })}
              className="h-6 w-14 text-xs"
              min={0}
              max={100}
            />
            <span className="text-gray-400">px</span>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Background:</Label>
            <input
              type="color"
              value={textContent.backgroundColor || '#ffffff'}
              onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
              className="h-6 w-8 rounded cursor-pointer"
            />
            {textContent.backgroundColor && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => onUpdate({ backgroundColor: undefined })}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Editable Content */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className={cn(
          'min-h-[40px] p-2 rounded focus:outline-none',
          fontSize,
          isSelected && 'bg-gray-50'
        )}
        style={{ textAlign: textContent.alignment }}
      />
    </div>
  )
}
