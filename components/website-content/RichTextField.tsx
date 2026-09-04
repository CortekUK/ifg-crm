'use client'

// A small rich-text editor for long-form legal copy.
//
// Same approach as the email TextBlock — contentEditable plus a toolbar over
// document.execCommand — so there is one editing idiom in the CRM and no new
// dependency for what amounts to headings, bold and lists.
//
// The value is HTML. It is sanitised on the way in (paste from Word carries a
// stack of junk markup) and again on the public site before rendering, so a
// tag that survives one pass cannot reach a visitor's browser from the other.

import * as React from 'react'
import DOMPurify from 'isomorphic-dompurify'
import {
  Bold, Italic, List, ListOrdered, Heading2, Heading3, Link2, Undo2, Redo2, Pilcrow,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * What a Terms & Conditions document is allowed to contain.
 *
 * Deliberately narrow: text, structure and links. No images, no styles, no
 * scripts, no iframes. A legal document needs none of them, and every tag
 * left out is one that cannot be used to do something unexpected on a public
 * page.
 */
export const TERMS_ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u',
  'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'blockquote',
]
export const TERMS_ALLOWED_ATTR = ['href', 'target', 'rel']

export function sanitiseTerms(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: TERMS_ALLOWED_TAGS,
    ALLOWED_ATTR: TERMS_ALLOWED_ATTR,
    // Anything else Word or a browser pastes in gets unwrapped rather than
    // dropped, so the words survive even when the markup does not.
    KEEP_CONTENT: true,
  })
}

/** Toolbar button. onMouseDown is prevented so clicking never steals the
 *  caret out of the editor before the command runs. */
function Btn({
  onClick, title, children, active,
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
  active?: boolean
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        'rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        active && 'bg-muted text-foreground',
      )}
    >
      {children}
    </button>
  )
}

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  id?: string
}

export function RichTextField({ value, onChange, placeholder, id }: Props) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [linkOpen, setLinkOpen] = React.useState(false)
  const [linkUrl, setLinkUrl] = React.useState('')

  // Write the incoming value into the DOM only when it differs from what the
  // element already holds. Assigning innerHTML on every render would move the
  // caret to the start on each keystroke.
  React.useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value
    }
  }, [value])

  const emit = () => {
    if (ref.current) onChange(ref.current.innerHTML)
  }

  const exec = (command: string, arg?: string) => {
    document.execCommand(command, false, arg)
    ref.current?.focus()
    emit()
  }

  const addLink = () => {
    const url = linkUrl.trim()
    if (!url) return
    exec('createLink', /^https?:\/\//i.test(url) ? url : `https://${url}`)
    setLinkUrl('')
    setLinkOpen(false)
  }

  // Paste as plain text where possible, then let the sanitiser tidy the rest.
  // Pasting a clause straight out of Word otherwise brings mso- styles, font
  // tags and comment blocks with it.
  const handlePaste = (e: React.ClipboardEvent) => {
    const html = e.clipboardData.getData('text/html')
    if (!html) return
    e.preventDefault()
    document.execCommand('insertHTML', false, sanitiseTerms(html))
    emit()
  }

  return (
    <div className="overflow-hidden rounded-md border border-input bg-background">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 p-1">
        <Btn onClick={() => exec('formatBlock', '<h2>')} title="Heading"><Heading2 className="h-4 w-4" /></Btn>
        <Btn onClick={() => exec('formatBlock', '<h3>')} title="Sub-heading"><Heading3 className="h-4 w-4" /></Btn>
        <Btn onClick={() => exec('formatBlock', '<p>')} title="Normal text"><Pilcrow className="h-4 w-4" /></Btn>
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn onClick={() => exec('bold')} title="Bold"><Bold className="h-4 w-4" /></Btn>
        <Btn onClick={() => exec('italic')} title="Italic"><Italic className="h-4 w-4" /></Btn>
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn onClick={() => exec('insertUnorderedList')} title="Bullet list"><List className="h-4 w-4" /></Btn>
        <Btn onClick={() => exec('insertOrderedList')} title="Numbered list"><ListOrdered className="h-4 w-4" /></Btn>
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn onClick={() => setLinkOpen((o) => !o)} title="Add link" active={linkOpen}><Link2 className="h-4 w-4" /></Btn>
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn onClick={() => exec('undo')} title="Undo"><Undo2 className="h-4 w-4" /></Btn>
        <Btn onClick={() => exec('redo')} title="Redo"><Redo2 className="h-4 w-4" /></Btn>
      </div>

      {linkOpen && (
        <div className="flex gap-2 border-b border-border bg-muted/20 p-2">
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLink())}
            placeholder="https://example.com"
            className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={addLink}
            className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            Add
          </button>
        </div>
      )}

      <div
        id={id}
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={() => {
          // Tidy on blur rather than on every keystroke — rewriting the DOM
          // mid-sentence fights the caret.
          if (!ref.current) return
          const clean = sanitiseTerms(ref.current.innerHTML)
          if (clean !== ref.current.innerHTML) {
            ref.current.innerHTML = clean
            onChange(clean)
          }
        }}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className="terms-editor min-h-[320px] max-h-[640px] overflow-y-auto p-3 text-sm leading-relaxed focus:outline-none"
      />

      <style jsx global>{`
        .terms-editor:empty::before {
          content: attr(data-placeholder);
          color: var(--muted-foreground, #94a3b8);
        }
        .terms-editor h2 { font-size: 1.05rem; font-weight: 700; margin: 1.1em 0 0.4em; }
        .terms-editor h3 { font-size: 0.95rem; font-weight: 700; margin: 1em 0 0.35em; }
        .terms-editor p { margin: 0 0 0.7em; }
        .terms-editor ul,
        .terms-editor ol { margin: 0 0 0.7em; padding-left: 1.4em; }
        .terms-editor ul { list-style: disc; }
        .terms-editor ol { list-style: decimal; }
        .terms-editor li { margin: 0.2em 0; }
        .terms-editor a { color: #2563eb; text-decoration: underline; }
      `}</style>
    </div>
  )
}
