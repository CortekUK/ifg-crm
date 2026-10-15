'use client'

import { useCallback, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { trimQuotedContent } from '@/lib/utils/trimQuotedContent'

/**
 * The body of one message in the mailbox.
 *
 * It used to be `<p>{message.body}</p>`, which threw away two things at once.
 *
 * The branding: every email the CRM sends is a designed document — logo
 * lockup, rules, a Schedule a Call button, the registered-office footer — and
 * all of it arrived in the recipient's inbox and none of it in ours. Staff
 * could not see what the player saw, which is the whole point of having the
 * thread in the CRM.
 *
 * And the content itself: of 35 outbound messages in threads, 35 have HTML and
 * only 11 have a text part. The other 24 rendered as "(no content)" — a sent
 * email showing as empty in the one place anyone would check.
 *
 * WHY AN IFRAME AND NOT dangerouslySetInnerHTML: inbound HTML is written by
 * whoever replied, so it is untrusted, and email HTML carries its own
 * stylesheet full of broad selectors that would leak straight into the CRM's
 * layout. A sandboxed frame solves both — no scripts run inside it, and its
 * CSS cannot reach out.
 *
 * `allow-same-origin` is set WITHOUT `allow-scripts`, which is what makes the
 * height measurable. It is the combination of the two that is unsafe; with
 * scripting off, nothing in the frame can execute at all.
 */

/**
 * Markers the mail clients IFG's players actually use put around a quoted
 * thread. Checked against the real replies in the CRM rather than guessed:
 * <blockquote> alone covers 23 of the 31 with HTML, gmail_quote and
 * type="cite" cover most of the rest.
 *
 * Hiding every <blockquote> is safe here even though it is a legitimate tag,
 * because none of the 2,205 emails the CRM has sent uses one — so the only
 * blockquote that ever appears in this view is a quoted thread. And nothing
 * is lost either way: the toggle brings it straight back.
 */
const HTML_QUOTE_MARKERS = [
  '<blockquote',
  'gmail_quote',
  'divRplyFwdMsg',
  'appendonsend',
  'yahoo_quoted',
  'moz-cite-prefix',
]

const QUOTE_HIDING_CSS = `
  blockquote, .gmail_quote, .gmail_quote_container, .yahoo_quoted,
  .moz-cite-prefix, #appendonsend, div[id^="divRplyFwdMsg"],
  div[id^="divRplyFwdMsg"] ~ *, #appendonsend ~ * { display: none !important; }
`

function hasQuotedHtml(html: string): boolean {
  return HTML_QUOTE_MARKERS.some((m) => html.includes(m))
}

/** Wrap the fragment in a real document so charset, links and margins behave. */
function buildSrcDoc(html: string, hideQuoted: boolean): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<base target="_blank">
<style>
  html,body { margin:0; padding:0; background:#fff; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; font-size:14px; color:#1f2937; word-wrap:break-word; }
  img { max-width:100%; height:auto; }
  table { max-width:100%; }
  ${hideQuoted ? QUOTE_HIDING_CSS : ''}
</style>
</head><body>${html}</body></html>`
}

function HtmlBody({ html }: { html: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(120)
  const [showQuoted, setShowQuoted] = useState(false)
  const quoted = hasQuotedHtml(html)

  // Measure on load AND keep measuring: a branded email is mostly images, and
  // they arrive after load, each one changing the height. Measuring once left
  // the frame cut off halfway down the header.
  const measure = useCallback(() => {
    const doc = frameRef.current?.contentDocument
    if (!doc?.documentElement) return
    setHeight(Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0) + 2)
  }, [])

  const onLoad = useCallback(() => {
    measure()
    const doc = frameRef.current?.contentDocument
    if (!doc?.body) return
    const observer = new ResizeObserver(measure)
    observer.observe(doc.body)
    // Cleared when the frame reloads or unmounts; the document goes with it.
    frameRef.current?.addEventListener('beforeunload', () => observer.disconnect())
  }, [measure])

  return (
    <div className="mt-3">
      <iframe
        ref={frameRef}
        title="Message"
        sandbox="allow-same-origin allow-popups"
        srcDoc={buildSrcDoc(html, quoted && !showQuoted)}
        onLoad={onLoad}
        style={{ height }}
        className="w-full rounded-lg border border-slate-800 bg-white"
      />
      {quoted && (
        <button
          onClick={() => setShowQuoted((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900/50 px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
        >
          <ChevronDown className={showQuoted ? 'h-3 w-3 rotate-180 transition-transform' : 'h-3 w-3 transition-transform'} />
          {showQuoted ? 'Hide quoted text' : 'Show quoted text'}
        </button>
      )}
    </div>
  )
}

function TextBody({ text }: { text: string }) {
  const [showQuoted, setShowQuoted] = useState(false)
  const trimmed = trimQuotedContent(text)
  const quoted = trimmed !== text

  return (
    <div className="mt-3">
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">
        {(showQuoted ? text : trimmed) || '(no content)'}
      </p>
      {quoted && (
        <button
          onClick={() => setShowQuoted((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900/50 px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
        >
          <ChevronDown className={showQuoted ? 'h-3 w-3 rotate-180 transition-transform' : 'h-3 w-3 transition-transform'} />
          {showQuoted ? 'Hide quoted text' : 'Show quoted text'}
        </button>
      )}
    </div>
  )
}

export function MessageBody({ html, text }: { html: string | null; text: string | null }) {
  // HTML wins when there is any. It is what the recipient saw, and for most
  // outbound messages it is the only copy that exists.
  if (html && html.trim()) return <HtmlBody html={html} />
  return <TextBody text={text ?? ''} />
}
