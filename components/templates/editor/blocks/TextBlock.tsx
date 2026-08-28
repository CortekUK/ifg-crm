'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  List,
  ListOrdered,
  Code,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEditorTheme } from '../EditorThemeContext'
import { TextBlockContent } from '@/lib/templates/editor-types'
import { MergeTagDropdown } from '../MergeTagDropdown'

interface TextBlockProps {
  content: Record<string, unknown>
  isSelected: boolean
  onUpdate: (updates: Record<string, unknown>) => void
}

export function TextBlock({ content, isSelected, onUpdate }: TextBlockProps) {
  const textContent = content as unknown as TextBlockContent
  const theme = useEditorTheme()
  const editorRef = useRef<HTMLDivElement>(null)
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [htmlMode, setHtmlMode] = useState(false)
  const [rawHtml, setRawHtml] = useState(textContent.html)

  useEffect(() => {
    if (!htmlMode && editorRef.current && editorRef.current.innerHTML !== textContent.html) {
      editorRef.current.innerHTML = textContent.html
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [htmlMode])

  useEffect(() => {
    setRawHtml(textContent.html)
  }, [textContent.html])

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
    if (htmlMode) {
      // Insert at cursor position in textarea
      setRawHtml((prev) => prev + variable)
      onUpdate({ html: rawHtml + variable })
      return
    }
    
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

  const toggleHtmlMode = () => {
    if (htmlMode) {
      // Switching from HTML mode to WYSIWYG - apply the raw HTML
      onUpdate({ html: rawHtml })
    } else {
      // Switching to HTML mode - get current HTML
      setRawHtml(textContent.html)
    }
    setHtmlMode(!htmlMode)
  }

  const handleRawHtmlChange = (value: string) => {
    setRawHtml(value)
    onUpdate({ html: value })
  }

  // Sized in px off the theme's base, exactly as renderTextBlock does. The
  // Tailwind classes this replaces were fixed sizes, so the theme's text-size
  // control moved nothing on the canvas.
  const base = theme.baseFontSize
  const fontSize =
    textContent.fontSize === 'small'
      ? Math.round(base * 0.875)
      : textContent.fontSize === 'large'
        ? Math.round(base * 1.125)
        : textContent.fontSize === 'xlarge'
          ? Math.round(base * 1.5)
          : base

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
        <div className="flex items-center gap-1 mb-2 p-1 bg-gray-100 dark:bg-slate-800 rounded-lg flex-wrap">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => execCommand('bold')}
            disabled={htmlMode}
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => execCommand('italic')}
            disabled={htmlMode}
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => execCommand('underline')}
            disabled={htmlMode}
          >
            <Underline className="h-3.5 w-3.5" />
          </Button>

          <div className="w-px h-5 bg-gray-300 dark:bg-slate-600 mx-1" />

          {/* List Buttons */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => execCommand('insertUnorderedList')}
            disabled={htmlMode}
            title="Bullet List"
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => execCommand('insertOrderedList')}
            disabled={htmlMode}
            title="Numbered List"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </Button>

          <div className="w-px h-5 bg-gray-300 dark:bg-slate-600 mx-1" />

          <Popover open={showLinkInput} onOpenChange={setShowLinkInput}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={htmlMode}>
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

          <div className="w-px h-5 bg-gray-300 dark:bg-slate-600 mx-1" />

          <Button
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7', textContent.alignment === 'left' && 'bg-gray-200')}
            onClick={() => onUpdate({ alignment: 'left' })}
            disabled={htmlMode}
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7', textContent.alignment === 'center' && 'bg-gray-200')}
            onClick={() => onUpdate({ alignment: 'center' })}
            disabled={htmlMode}
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7', textContent.alignment === 'right' && 'bg-gray-200')}
            onClick={() => onUpdate({ alignment: 'right' })}
            disabled={htmlMode}
          >
            <AlignRight className="h-3.5 w-3.5" />
          </Button>

          <div className="w-px h-5 bg-gray-300 dark:bg-slate-600 mx-1" />

          <select
            value={textContent.fontSize}
            onChange={(e) => onUpdate({ fontSize: e.target.value as TextBlockContent['fontSize'] })}
            className="h-7 px-2 text-xs border rounded bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
            disabled={htmlMode}
          >
            <option value="small">Small</option>
            <option value="normal">Normal</option>
            <option value="large">Large</option>
            <option value="xlarge">X-Large</option>
          </select>

          <div className="w-px h-5 bg-gray-300 dark:bg-slate-600 mx-1" />

          <MergeTagDropdown onInsert={insertVariable} variant="compact" />

          <div className="w-px h-5 bg-gray-300 dark:bg-slate-600 mx-1" />

          {/* HTML Mode Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7', htmlMode && 'bg-blue-100 dark:bg-blue-900/50 text-blue-600')}
            onClick={toggleHtmlMode}
            title={htmlMode ? 'Switch to Visual Editor' : 'Edit HTML'}
          >
            <Code className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Settings panel when selected */}
      {isSelected && !htmlMode && (
        <div className="flex items-center gap-4 mb-2 text-xs">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-slate-700 dark:text-slate-300">Padding:</Label>
            <Input
              type="number"
              value={textContent.paddingTop}
              onChange={(e) => onUpdate({ paddingTop: parseInt(e.target.value) || 0 })}
              className="h-6 w-14 text-xs"
              min={0}
              max={100}
            />
            <span className="text-gray-400 dark:text-gray-500">px</span>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-slate-700 dark:text-slate-300">Background:</Label>
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

      {/* Content Area - WYSIWYG or HTML Mode */}
      {htmlMode ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">HTML Source</Label>
            <span className="text-xs text-blue-600">Editing HTML</span>
          </div>
          <Textarea
            value={rawHtml}
            onChange={(e) => handleRawHtmlChange(e.target.value)}
            className="font-mono text-sm min-h-[150px] bg-gray-900 text-green-400"
            placeholder="<p>Enter HTML here...</p>"
          />
        </div>
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          // ifg-rich pulls the theme's body font, heading font and ink
          // colour from the canvas — the same values the renderer uses.
          className={cn(
            'ifg-rich min-h-[40px] p-2 rounded focus:outline-none',
            isSelected && 'bg-gray-50'
          )}
          style={{ textAlign: textContent.alignment, fontSize, lineHeight: 1.6 }}
        />
      )}
    </div>
  )
}
